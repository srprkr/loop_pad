#include "PluginProcessor.h"
#include "PluginEditor.h"

using namespace juce;

namespace
{
    // Plugin state = the APVTS tree plus one child holding everything that isn't a parameter.
    const Identifier extraStateTag ("ExtraState");
    const Identifier samplePathProp ("samplePath");
    const Identifier uiStateProp ("uiState");
    const Identifier presetIdProp ("presetId");

    constexpr int maxEventsPerBlock = 2048;
} // namespace

PluginProcessor::PluginProcessor()
    : AudioProcessor (BusesProperties().withOutput ("Output", AudioChannelSet::stereo(), true)),
      state (*this, nullptr, "PluginState", createParameterLayout()),
      parameterSnapshot (state),
      presets (state)
{
    blockEvents.reserve (maxEventsPerBlock);
    startTimerHz (2); // frees samples the audio thread no longer uses
}

PluginProcessor::~PluginProcessor()
{
    stopTimer();
}

//==============================================================================
void PluginProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
    engine.prepare (sampleRate, samplesPerBlock);
    engine.setSample (mainSample.data);
}

bool PluginProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    return layouts.getMainOutputChannelSet() == AudioChannelSet::stereo();
}

void PluginProcessor::processBlock (AudioBuffer<float>& buffer, MidiBuffer& midi)
{
    ScopedNoDenormals noDenormals;

    // Pick up a new sample from the UI, if the UI isn't mid-update.
    if (std::unique_lock lock (handoverMutex, std::try_to_lock); lock.owns_lock())
    {
        if (samplePending)
        {
            engine.setSample (pendingSample);
            pendingSample.reset(); // the message thread still holds a reference, so nothing is freed here
            samplePending = false;
        }
    }

    engine.setParams (parameterSnapshot.read());

    core::TransportInfo transport;
    if (auto* hostPlayHead = getPlayHead())
    {
        if (const auto position = hostPlayHead->getPosition())
        {
            if (const auto bpm = position->getBpm())
                transport.bpm = *bpm;
            transport.isPlaying = position->getIsPlaying();
            if (const auto ppq = position->getPpqPosition())
            {
                transport.hasPpqPosition = true;
                transport.ppqPosition = *ppq;
            }
        }
    }

    // UI notes first (at the start of the block), then host MIDI in time order.
    blockEvents.clear();
    uiNoteFifo.read (uiNoteFifo.getNumReady()).forEach ([this] (int index)
    {
        if (blockEvents.size() < maxEventsPerBlock)
            blockEvents.push_back (uiNotes[(size_t) index]);
    });

    for (const auto metadata : midi)
    {
        if (blockEvents.size() >= maxEventsPerBlock)
            break;

        const auto message = metadata.getMessage();
        const int offset = jlimit (0, buffer.getNumSamples() - 1, metadata.samplePosition);
        using Type = core::NoteEvent::Type;

        if (message.isNoteOn())
            blockEvents.push_back ({ Type::NoteOn, offset, message.getNoteNumber(), message.getVelocity() });
        else if (message.isNoteOff())
            blockEvents.push_back ({ Type::NoteOff, offset, message.getNoteNumber(), 0 });
        else if (message.isAllNotesOff() || message.isAllSoundOff())
            blockEvents.push_back ({ Type::AllNotesOff, offset, 0, 0 });
    }

    engine.process (buffer.getWritePointer (0), buffer.getWritePointer (1), buffer.getNumSamples(),
                    transport, blockEvents.data(), (int) blockEvents.size());

    if (std::unique_lock lock (telemetryMutex, std::try_to_lock); lock.owns_lock())
        telemetry = engine.getTelemetry();
}

//==============================================================================
AudioProcessorEditor* PluginProcessor::createEditor()
{
    return new PluginEditor (*this);
}

void PluginProcessor::getStateInformation (MemoryBlock& destData)
{
    auto tree = state.copyState();

    ValueTree extra (extraStateTag);
    extra.setProperty (samplePathProp, mainSample.data ? String (mainSample.data->sourcePath) : String(), nullptr);
    extra.setProperty (uiStateProp, JSON::toString (uiState, true), nullptr);
    extra.setProperty (presetIdProp, presets.getCurrentPresetId(), nullptr);
    tree.appendChild (extra, nullptr);

    if (auto xml = tree.createXml())
        copyXmlToBinary (*xml, destData);
}

void PluginProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    auto xml = getXmlFromBinary (data, sizeInBytes);
    if (xml == nullptr || ! xml->hasTagName (state.state.getType()))
        return;

    auto tree = ValueTree::fromXml (*xml);
    const auto extra = tree.getChildWithName (extraStateTag).createCopy();
    tree.removeChild (tree.getChildWithName (extraStateTag), nullptr);
    state.replaceState (tree);

    // Sample loading and UI notification must happen on the message thread.
    auto restore = [this, extra]
    {
        uiState = JSON::parse (extra[uiStateProp].toString());
        presets.setCurrentPresetId (extra[presetIdProp].toString());

        String error;
        const auto path = extra[samplePathProp].toString();
        if (path.isEmpty() || ! File::isAbsolutePath (path) || ! loadSample (SampleSlot::Main, File (path), false, error))
            clearSample (SampleSlot::Main);

        sendChangeMessage();
    };

    if (MessageManager::getInstance()->isThisTheMessageThread())
        restore();
    else
        MessageManager::callAsync (restore);
}

//==============================================================================
void PluginProcessor::setParameterPlainValue (const char* paramId, float value)
{
    if (auto* parameter = state.getParameter (paramId))
    {
        parameter->beginChangeGesture();
        parameter->setValueNotifyingHost (parameter->convertTo0to1 (value));
        parameter->endChangeGesture();
    }
}

bool PluginProcessor::loadSample (SampleSlot, const File& file, bool resetMarkers, String& error)
{
    auto loaded = sampleLibrary.load (file, error);
    if (loaded.data == nullptr)
        return false;

    if (mainSample.data != nullptr)
        retiredSamples.push_back (mainSample.data);
    mainSample = std::move (loaded);

    if (resetMarkers)
    {
        setParameterPlainValue (ParamIds::startPos, 0.0f);
        setParameterPlainValue (ParamIds::endPos, 1.0f);
        setParameterPlainValue (ParamIds::loopStartPos, 0.0f);
        setParameterPlainValue (ParamIds::loopEndPos, 1.0f);
        setParameterPlainValue (ParamIds::loopCrossfade, 0.02f);
        setParameterPlainValue (ParamIds::preserveSpeed, 1.0f);
        setParameterPlainValue (ParamIds::tempoSync, 1.0f);
    }

    publishSampleToAudioThread();
    return true;
}

void PluginProcessor::clearSample (SampleSlot)
{
    if (mainSample.data != nullptr)
        retiredSamples.push_back (mainSample.data);
    mainSample = {};
    publishSampleToAudioThread();
}

const LoadedSample& PluginProcessor::getSample (SampleSlot) const noexcept
{
    return mainSample;
}

void PluginProcessor::publishSampleToAudioThread()
{
    std::lock_guard lock (handoverMutex);
    pendingSample = mainSample.data;
    samplePending = true;
}

void PluginProcessor::pushUiNote (const core::NoteEvent& event)
{
    uiNoteFifo.write (1).forEach ([this, &event] (int index) { uiNotes[(size_t) index] = event; });
}

bool PluginProcessor::applyPreset (const String& presetId)
{
    if (! presets.load (presetId))
        return false;

    sendChangeMessage();
    return true;
}

core::EngineTelemetry PluginProcessor::getTelemetry() const
{
    std::lock_guard lock (telemetryMutex);
    return telemetry;
}

void PluginProcessor::timerCallback()
{
    // A retired sample can be freed once only this list (and no pending hand-over) holds it.
    std::lock_guard lock (handoverMutex);
    if (samplePending)
        return;

    retiredSamples.erase (std::remove_if (retiredSamples.begin(), retiredSamples.end(),
                                          [] (const core::SamplePtr& s) { return s.use_count() == 1; }),
                          retiredSamples.end());
}

//==============================================================================
AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new PluginProcessor();
}
