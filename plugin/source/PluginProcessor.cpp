#include "PluginProcessor.h"
#include "PluginEditor.h"

using namespace juce;

namespace
{
    // Plugin state = the APVTS tree plus one child holding everything that isn't a parameter.
    const Identifier extraStateTag ("ExtraState");
    const Identifier kitProp ("kit");
    const Identifier uiStateProp ("uiState");
    const Identifier loopProp ("loop");

    constexpr int maxPendingHits = 256;

    /** The default 4x4 layout (ui/src/data/defaultPads.ts), so MIDI plays before the UI has ever opened. */
    struct DefaultPad { const char* sound; char key; };
    constexpr DefaultPad defaultPads[] = {
        { "closed_hat", '1' }, { "open_hat", '2' },    { "shaker", '3' },    { "crash", '4' },
        { "clap", 'Q' },       { "tight_snare", 'W' }, { "rimshot", 'E' },   { "cowbell", 'R' },
        { "high_tom", 'A' },   { "mid_tom", 'S' },     { "low_tom", 'D' },   { "laser_fx", 'F' },
        { "punch_kick", 'Z' }, { "sub_808", 'X' },     { "thud_kick", 'C' }, { "noise_drop", 'V' },
    };

    var loopToVar (const core::Loop& loop)
    {
        Array<var> notes;
        for (int i = 0; i < loop.count; ++i)
        {
            const auto& n = loop.notes[(size_t) i];
            auto* object = new DynamicObject();
            object->setProperty ("step", n.step);
            object->setProperty ("sound", core::DrumKit::sound (n.sound).id);
            object->setProperty ("pitch", n.pitch);
            object->setProperty ("volume", n.volume);
            object->setProperty ("key", String::charToString ((juce_wchar) (unsigned char) n.padKey));
            notes.add (var (object));
        }
        return notes;
    }

    void loopFromVar (const var& value, core::Loop& loop)
    {
        loop.clear();
        if (const auto* notes = value.getArray())
            for (const auto& item : *notes)
            {
                const int sound = core::DrumKit::findSound (item["sound"].toString().toStdString());
                const int step = (int) item["step"];
                if (sound < 0 || ! isPositiveAndBelow (step, core::Loop::steps))
                    continue;

                core::LoopNote note;
                note.step = step;
                note.sound = sound;
                note.pitch = jlimit (-12.0f, 12.0f, (float) (double) item["pitch"]);
                note.volume = jlimit (0.0f, 1.3f, (float) (double) item["volume"]);
                note.padKey = (char) item["key"].toString()[0];
                loop.add (note);
            }
    }
} // namespace

PluginProcessor::PluginProcessor()
    : AudioProcessor (BusesProperties().withOutput ("Output", AudioChannelSet::stereo(), true)),
      state (*this, nullptr, "PluginState", createParameterLayout()),
      parameterSnapshot (state)
{
    blockCommands.reserve (commandFifoSize + 1024);
    pendingHits.reserve (maxPendingHits);
    publishPadTable();
    startTimerHz (30); // keeps the loop copy in step with the engine
}

PluginProcessor::~PluginProcessor()
{
    stopTimer();
}

//==============================================================================
void PluginProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
    engine.prepare (sampleRate, samplesPerBlock);
}

bool PluginProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    return layouts.getMainOutputChannelSet() == AudioChannelSet::stereo();
}

void PluginProcessor::processBlock (AudioBuffer<float>& buffer, MidiBuffer& midi)
{
    ScopedNoDenormals noDenormals;

    // Pick up a new pad table or restored loop, if the message thread isn't mid-update.
    if (std::unique_lock lock (handoverMutex, std::try_to_lock); lock.owns_lock())
    {
        if (padsPending)
        {
            audioPads = pendingPads;
            padsPending = false;
        }
        if (loopPending)
        {
            engine.setLoop (*pendingLoop);
            loopPending = false;
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

    // UI commands first (at the start of the block), then host MIDI in time order.
    blockCommands.clear();
    commandFifo.read (commandFifo.getNumReady()).forEach ([this] (int index)
    {
        auto command = commandSlots[(size_t) index];
        command.sampleOffset = 0;
        blockCommands.push_back (command);
    });

    const int numSamples = buffer.getNumSamples();
    for (const auto metadata : midi)
    {
        if (blockCommands.size() >= blockCommands.capacity())
            break;

        const auto message = metadata.getMessage();
        if (! message.isNoteOn())
            continue;

        const int padIndex = message.getNoteNumber() - firstPadNote;
        if (! isPositiveAndBelow (padIndex, maxPads) || audioPads[(size_t) padIndex].sound < 0)
            continue;

        const auto& pad = audioPads[(size_t) padIndex];
        core::EngineCommand command;
        command.type = core::EngineCommand::Type::Trigger;
        command.sampleOffset = jlimit (0, jmax (0, numSamples - 1), metadata.samplePosition);
        command.sound = pad.sound;
        command.pitch = pad.pitch;
        command.volume = pad.volume * (float) message.getVelocity() / 127.0f;
        command.padKey = pad.key;
        blockCommands.push_back (command);
    }

    for (int ch = 2; ch < buffer.getNumChannels(); ++ch)
        buffer.clear (ch, 0, numSamples);

    engine.process (buffer.getWritePointer (0), buffer.getWritePointer (jmin (1, buffer.getNumChannels() - 1)), numSamples,
                    transport, blockCommands.data(), (int) blockCommands.size());

    const auto* events = engine.getEvents();
    const int numEvents = jmin (engine.getNumEvents(), eventFifo.getFreeSpace());
    eventFifo.write (numEvents).forEach ([this, events, i = 0] (int index) mutable { eventSlots[(size_t) index] = events[i++]; });

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
    if (MessageManager::getInstance()->isThisTheMessageThread())
        drainEngineEvents(); // include hits recorded since the last timer tick

    auto tree = state.copyState();

    ValueTree extra (extraStateTag);
    extra.setProperty (kitProp, kit.isVoid() ? String() : JSON::toString (kit, true), nullptr);
    extra.setProperty (uiStateProp, JSON::toString (uiState, true), nullptr);
    extra.setProperty (loopProp, JSON::toString (loopToVar (*loopCopy), true), nullptr);
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

    auto restore = [this, extra]
    {
        const auto kitText = extra[kitProp].toString();
        kit = kitText.isNotEmpty() ? JSON::parse (kitText) : var();
        publishPadTable();

        uiState = JSON::parse (extra[uiStateProp].toString());

        drainEngineEvents(); // drop anything the old loop reported
        loopFromVar (JSON::parse (extra[loopProp].toString()), *loopCopy);
        publishLoop();

        sendChangeMessage();
    };

    if (MessageManager::getInstance()->isThisTheMessageThread())
        restore();
    else
        MessageManager::callAsync (restore);
}

//==============================================================================
void PluginProcessor::setKit (const var& newKit)
{
    kit = newKit;
    publishPadTable();
}

void PluginProcessor::publishPadTable()
{
    // MIDI plays the pads of the grid that is showing.
    PadTable table {};
    const auto gridSize = kit["gridSize"].toString();
    const auto* pads = gridSize.isNotEmpty() ? kit["pads"][Identifier (gridSize)].getArray() : nullptr;

    if (pads == nullptr)
    {
        for (size_t i = 0; i < std::size (defaultPads); ++i)
            table[i] = { core::DrumKit::findSound (defaultPads[i].sound), 0.0f, 1.0f, defaultPads[i].key };
    }
    else
    {
        for (int i = 0; i < jmin (maxPads, pads->size()); ++i)
        {
            const auto& pad = pads->getReference (i);
            auto& slot = table[(size_t) i];
            slot.sound = core::DrumKit::findSound (pad["soundType"].toString().toStdString());
            slot.pitch = jlimit (-12.0f, 12.0f, (float) (double) pad["pitchSemitones"]);
            slot.volume = jlimit (0.0f, 1.3f, (float) (double) pad["volume"]);
            slot.key = (char) pad["key"].toString()[0];
        }
    }

    std::lock_guard lock (handoverMutex);
    pendingPads = table;
    padsPending = true;
}

void PluginProcessor::publishLoop()
{
    std::lock_guard lock (handoverMutex);
    *pendingLoop = *loopCopy;
    loopPending = true;
}

void PluginProcessor::pushCommand (const core::EngineCommand& command)
{
    commandFifo.write (1).forEach ([this, &command] (int index) { commandSlots[(size_t) index] = command; });
}

std::vector<core::LoopNote> PluginProcessor::takeLoopHits()
{
    drainEngineEvents();
    std::vector<core::LoopNote> hits;
    hits.swap (pendingHits);
    pendingHits.reserve (maxPendingHits);
    return hits;
}

void PluginProcessor::drainEngineEvents()
{
    using Type = core::EngineEvent::Type;

    eventFifo.read (eventFifo.getNumReady()).forEach ([this] (int index)
    {
        const auto& event = eventSlots[(size_t) index];
        switch (event.type)
        {
            case Type::LoopCleared:  loopCopy->clear(); break;
            case Type::NoteRecorded: loopCopy->add (event.note); break;
            case Type::LoopHit:
                if (pendingHits.size() < (size_t) maxPendingHits) // nobody is collecting them while the editor is closed
                    pendingHits.push_back (event.note);
                break;
        }
    });
}

core::EngineTelemetry PluginProcessor::getTelemetry() const
{
    std::lock_guard lock (telemetryMutex);
    return telemetry;
}

void PluginProcessor::timerCallback()
{
    drainEngineEvents();
}

//==============================================================================
AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new PluginProcessor();
}
