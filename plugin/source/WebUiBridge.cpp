#include "WebUiBridge.h"

using namespace juce;

namespace
{
    String kindOf (const RangedAudioParameter& parameter)
    {
        if (dynamic_cast<const AudioParameterBool*> (&parameter) != nullptr)   return "bool";
        if (dynamic_cast<const AudioParameterChoice*> (&parameter) != nullptr) return "choice";
        if (dynamic_cast<const AudioParameterInt*> (&parameter) != nullptr)    return "int";
        return "float";
    }

    float plainValueOf (const RangedAudioParameter& parameter)
    {
        return parameter.convertFrom0to1 (parameter.getValue());
    }

    const var& arg (const Array<var>& args, int index)
    {
        static const var none;
        return isPositiveAndBelow (index, args.size()) ? args.getReference (index) : none;
    }

    /** A pad hit from the UI: (soundType, pitchSemitones, volume[, padKey]). */
    std::optional<core::EngineCommand> soundCommand (core::EngineCommand::Type type, const Array<var>& args)
    {
        const int sound = core::DrumKit::findSound (arg (args, 0).toString().toStdString());
        if (sound < 0)
            return std::nullopt;

        core::EngineCommand command;
        command.type = type;
        command.sound = sound;
        command.pitch = jlimit (-12.0f, 12.0f, (float) (double) arg (args, 1));
        command.volume = jlimit (0.0f, 1.3f, (float) (double) arg (args, 2));
        command.padKey = (char) arg (args, 3).toString()[0];
        return command;
    }
} // namespace

//==============================================================================
WebUiBridge::WebUiBridge (PluginProcessor& p)
    : processor (p)
{
    for (auto* parameter : processor.getParameters())
        if (auto* ranged = dynamic_cast<RangedAudioParameter*> (parameter))
            parameters.add (ranged);

    parameterDirty = std::vector<std::atomic<bool>> ((size_t) processor.getParameters().size());

    for (auto* parameter : parameters)
        parameter->addListener (this);
}

WebUiBridge::~WebUiBridge()
{
    stopTimer();
    for (auto* parameter : parameters)
        parameter->removeListener (this);
}

WebBrowserComponent::Options WebUiBridge::registerNativeFunctions (WebBrowserComponent::Options options)
{
    const auto fn = [&options] (const char* name, std::function<void (const Args&, Completion)> body)
    {
        options = options.withNativeFunction (name, [body] (const Args& args, Completion complete) { body (args, std::move (complete)); });
    };

    // State --------------------------------------------------------------------
    fn ("getInitialState", [this] (const Args&, Completion done) { done (describeState()); });

    fn ("setUiState", [this] (const Args& a, Completion done)
    {
        processor.setUiState (arg (a, 0));
        done ({});
    });

    fn ("setKit", [this] (const Args& a, Completion done)
    {
        processor.setKit (arg (a, 0));
        done ({});
    });

    // Parameters ---------------------------------------------------------------
    fn ("setParameter", [this] (const Args& a, Completion done)
    {
        setParameter (arg (a, 0).toString(), (float) (double) arg (a, 1));
        done ({});
    });
    fn ("beginGesture", [this] (const Args& a, Completion done) { beginGesture (arg (a, 0).toString()); done ({}); });
    fn ("endGesture",   [this] (const Args& a, Completion done) { endGesture (arg (a, 0).toString());   done ({}); });

    // Pads ---------------------------------------------------------------------
    using Type = core::EngineCommand::Type;

    fn ("triggerPad", [this] (const Args& a, Completion done)
    {
        if (const auto command = soundCommand (Type::Trigger, a))
            processor.pushCommand (*command);
        done ({});
    });

    fn ("previewSound", [this] (const Args& a, Completion done)
    {
        if (const auto command = soundCommand (Type::Preview, a))
            processor.pushCommand (*command);
        done ({});
    });

    // Transport ----------------------------------------------------------------
    const auto transportCommand = [this] (Type type)
    {
        return [this, type] (const Args&, Completion done)
        {
            core::EngineCommand command;
            command.type = type;
            processor.pushCommand (command);
            done ({});
        };
    };

    fn ("record", transportCommand (Type::Record));
    fn ("togglePlay", transportCommand (Type::TogglePlay));
    fn ("stop", transportCommand (Type::Stop));

    return options;
}

void WebUiBridge::attach (WebBrowserComponent& b)
{
    browser = &b;
    processor.takeLoopHits(); // don't replay hits from while the editor was closed
    startTimerHz (30);
}

void WebUiBridge::notifyStateReplaced()
{
    emit ("stateReplaced", {});
}

//==============================================================================
var WebUiBridge::describeState() const
{
    auto* object = new DynamicObject();
    object->setProperty ("parameters", describeParameters());
    object->setProperty ("kit", processor.getKit());
    object->setProperty ("uiState", processor.getUiState());
    object->setProperty ("productName", JucePlugin_Name);
    object->setProperty ("version", JucePlugin_VersionString);
    return var (object);
}

var WebUiBridge::describeParameters() const
{
    Array<var> list;

    for (auto* parameter : parameters)
    {
        const auto& range = parameter->getNormalisableRange();
        auto* object = new DynamicObject();
        object->setProperty ("id", parameter->getParameterID());
        object->setProperty ("name", parameter->getName (64));
        object->setProperty ("kind", kindOf (*parameter));
        object->setProperty ("min", range.start);
        object->setProperty ("max", range.end);
        object->setProperty ("defaultValue", parameter->convertFrom0to1 (parameter->getDefaultValue()));
        object->setProperty ("value", plainValueOf (*parameter));

        if (auto* choice = dynamic_cast<AudioParameterChoice*> (parameter))
        {
            Array<var> choices;
            for (const auto& c : choice->choices)
                choices.add (c);
            object->setProperty ("choices", choices);
        }

        list.add (var (object));
    }

    return list;
}

//==============================================================================
void WebUiBridge::setParameter (const String& id, float plainValue)
{
    auto* parameter = dynamic_cast<RangedAudioParameter*> (processor.getState().getParameter (id));
    if (parameter == nullptr)
        return;

    // One-off changes (clicks, typed values) still need a gesture so hosts record automation.
    const bool needsGesture = ! activeGestures.contains (id);
    if (needsGesture) parameter->beginChangeGesture();
    parameter->setValueNotifyingHost (parameter->convertTo0to1 (plainValue));
    if (needsGesture) parameter->endChangeGesture();
}

void WebUiBridge::beginGesture (const String& id)
{
    if (auto* parameter = processor.getState().getParameter (id); parameter != nullptr && ! activeGestures.contains (id))
    {
        activeGestures.add (id);
        parameter->beginChangeGesture();
    }
}

void WebUiBridge::endGesture (const String& id)
{
    if (auto* parameter = processor.getState().getParameter (id); parameter != nullptr && activeGestures.contains (id))
    {
        activeGestures.removeString (id);
        parameter->endChangeGesture();
    }
}

//==============================================================================
void WebUiBridge::emit (const Identifier& eventId, const var& payload)
{
    if (browser != nullptr)
        browser->emitEventIfBrowserIsVisible (eventId, payload);
}

void WebUiBridge::parameterValueChanged (int parameterIndex, float)
{
    // May be called on the audio thread (automation): just flag it.
    if (isPositiveAndBelow (parameterIndex, (int) parameterDirty.size()))
        parameterDirty[(size_t) parameterIndex].store (true, std::memory_order_relaxed);
}

void WebUiBridge::timerCallback()
{
    auto* changed = new DynamicObject();
    for (auto* parameter : parameters)
    {
        const auto index = (size_t) parameter->getParameterIndex();
        if (parameterDirty[index].exchange (false, std::memory_order_relaxed))
            changed->setProperty (parameter->getParameterID(), plainValueOf (*parameter));
    }

    if (! changed->getProperties().isEmpty())
        emit ("parameters", var (changed));
    else
        delete changed;

    const auto t = processor.getTelemetry();

    Array<var> hits;
    for (const auto& note : processor.takeLoopHits())
    {
        auto* hit = new DynamicObject();
        hit->setProperty ("padKey", String::charToString ((juce_wchar) (unsigned char) note.padKey));
        hit->setProperty ("soundType", core::DrumKit::sound (note.sound).id);
        hits.add (var (hit));
    }

    auto* telemetry = new DynamicObject();
    telemetry->setProperty ("peak", Array<var> { t.peakLeft, t.peakRight });
    telemetry->setProperty ("mode", core::toString (t.mode));
    telemetry->setProperty ("step", t.step);
    telemetry->setProperty ("recordBeat", (int) t.recordBeat);
    telemetry->setProperty ("bpm", t.bpm);
    telemetry->setProperty ("hostSynced", t.hostSynced);
    telemetry->setProperty ("hits", hits);
    telemetry->setProperty ("loopLength", t.loopLength);
    emit ("telemetry", var (telemetry));
}
