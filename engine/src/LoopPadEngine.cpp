#include "core/LoopPadEngine.h"

#include <algorithm>
#include <cmath>

namespace core
{

namespace
{
    constexpr double masterSmoothingSec = 0.01; // the prototype's setTargetAtTime (..., 0.01)

    /** Unity below the knee, then a smooth tanh curve to a ceiling of 1.0 (pad volume goes to 130%). */
    float softClip (float x) noexcept
    {
        constexpr float knee = 0.8f;
        const float magnitude = std::abs (x);
        if (magnitude <= knee)
            return x;
        const float shaped = knee + (1.0f - knee) * std::tanh ((magnitude - knee) / (1.0f - knee));
        return std::copysign (shaped, x);
    }
} // namespace

void Loop::add (const LoopNote& note) noexcept
{
    for (int i = 0; i < count; ++i)
    {
        auto& existing = notes[static_cast<size_t> (i)];
        if (existing.step == note.step && existing.sound == note.sound)
        {
            existing = note;
            return;
        }
    }

    if (count < maxNotes)
        notes[static_cast<size_t> (count++)] = note;
}

const char* toString (TransportMode mode) noexcept
{
    switch (mode)
    {
        case TransportMode::Idle:      return "idle";
        case TransportMode::CountIn:   return "countIn";
        case TransportMode::Recording: return "recording";
        case TransportMode::Playing:   return "playing";
    }
    return "idle";
}

//==============================================================================
void LoopPadEngine::prepare (double newSampleRate, int)
{
    sampleRate = newSampleRate;
    gainCoefficient = static_cast<float> (1.0 - std::exp (-1.0 / (masterSmoothingSec * sampleRate)));
    smoothedGain = params.mute ? 0.0f : params.masterVolume;
    for (auto& voice : voices)
        voice.kill();
}

TransportMode LoopPadEngine::getMode() const noexcept
{
    if (! running)
        return TransportMode::Idle;
    if (recordRun && position < 0.0)
        return TransportMode::CountIn;
    if (recordRun && position < Loop::steps)
        return TransportMode::Recording;
    return TransportMode::Playing;
}

void LoopPadEngine::process (float* left, float* right, int numSamples, const TransportInfo& transport,
                             const EngineCommand* commands, int numCommands) noexcept
{
    numEvents = 0;
    std::fill (left, left + numSamples, 0.0f);

    const bool hostSynced = transport.isPlaying && transport.bpm > 0.0;
    const double bpm = std::clamp (hostSynced ? transport.bpm : static_cast<double> (params.bpm), 20.0, 999.0);
    const double newStepsPerSample = bpm / 60.0 * 4.0 / sampleRate;
    if (newStepsPerSample != stepsPerSample)
    {
        anchorPosition = position;
        samplesSinceAnchor = 0;
        stepsPerSample = newStepsPerSample;
    }

    // Commands and steps, sample by sample. Voices are started with their offset in the block.
    int c = 0;
    for (int i = 0; i < numSamples; ++i)
    {
        for (; c < numCommands && commands[c].sampleOffset <= i; ++c)
            handleCommand (commands[c], i);

        if (running)
        {
            while (running && position >= static_cast<double> (nextStep))
                fireStep (nextStep++, i);
            position = anchorPosition + static_cast<double> (++samplesSinceAnchor) * stepsPerSample;
        }
    }
    for (; c < numCommands; ++c)
        handleCommand (commands[c], std::max (0, numSamples - 1));

    for (auto& voice : voices)
        voice.render (left, numSamples);

    // Master volume (smoothed), soft clip, mono to stereo.
    const float target = params.mute ? 0.0f : std::clamp (params.masterVolume, 0.0f, 1.0f);
    float peak = 0.0f;
    for (int i = 0; i < numSamples; ++i)
    {
        smoothedGain += (target - smoothedGain) * gainCoefficient;
        const float y = softClip (left[i] * smoothedGain);
        left[i] = y;
        right[i] = y;
        peak = std::max (peak, std::abs (y));
    }

    const auto mode = getMode();
    telemetry.peakLeft = telemetry.peakRight = peak;
    telemetry.mode = mode;
    telemetry.step = mode == TransportMode::Idle    ? 0
                   : mode == TransportMode::CountIn ? static_cast<int> (std::floor (position))
                                                    : static_cast<int> (static_cast<int64_t> (std::floor (position)) % Loop::steps);
    telemetry.recordBeat = recordBeat;
    telemetry.bpm = bpm;
    telemetry.hostSynced = hostSynced;
    telemetry.loopLength = loop.count;
}

//==============================================================================
void LoopPadEngine::handleCommand (const EngineCommand& command, int offset) noexcept
{
    using Type = EngineCommand::Type;
    const auto mode = getMode();

    switch (command.type)
    {
        case Type::Trigger:
            if (command.sound >= 0 && command.sound < DrumKit::numSounds())
            {
                startVoice (DrumKit::sound (command.sound), command.pitch, command.volume, offset);
                recordHit (command);
            }
            break;

        case Type::Preview:
            if (command.sound >= 0 && command.sound < DrumKit::numSounds())
                startVoice (DrumKit::sound (command.sound), command.pitch, command.volume, offset);
            break;

        case Type::Record:
            if (mode == TransportMode::CountIn || mode == TransportMode::Recording)
                running = false;
            else
                startTransport (true);
            break;

        case Type::TogglePlay:
            if (mode == TransportMode::Playing)
                running = false;
            else
                startTransport (false);
            break;

        case Type::Stop:
            running = false;
            break;
    }
}

void LoopPadEngine::startTransport (bool withRecording) noexcept
{
    running = true;
    recordRun = withRecording;
    loopClearedForTake = false;
    position = withRecording ? -static_cast<double> (countInSteps) : 0.0;
    anchorPosition = position;
    samplesSinceAnchor = 0;
    nextStep = withRecording ? -countInSteps : 0;
}

void LoopPadEngine::recordHit (const EngineCommand& command) noexcept
{
    if (! running || ! recordRun)
        return;

    // Accept hits from half a step before the downbeat to the end of the pass; snap to the nearest 16th.
    if (position < -0.5 || position >= static_cast<double> (Loop::steps))
        return;

    const auto rounded = std::max<int64_t> (0, std::llround (position));
    LoopNote note;
    note.step = static_cast<int> (rounded % Loop::steps);
    note.sound = command.sound;
    note.pitch = command.pitch;
    note.volume = command.volume;
    note.padKey = command.padKey;

    clearLoopForNewTake();
    loop.add (note);
    pushEvent (EngineEvent::Type::NoteRecorded, note);
}

void LoopPadEngine::fireStep (int64_t step, int offset) noexcept
{
    using Click = DrumKit::Click;

    if (step < 0)
    {
        if (step % 4 == 0 && params.metronome)
            startVoice (DrumKit::click (step == -countInSteps ? Click::CountInAccent : Click::CountIn), 0.0f, 1.0f, offset);
        return;
    }

    const int loopStep = static_cast<int> (step % Loop::steps);
    const bool recordingPass = recordRun && step < Loop::steps;

    if (loopStep % 4 == 0)
    {
        if (params.metronome)
            startVoice (DrumKit::click (loopStep % 16 == 0 ? Click::BarAccent : Click::Beat), 0.0f, 1.0f, offset);
        if (recordingPass)
            ++recordBeat;
    }

    if (recordingPass)
    {
        if (step == 0)
            clearLoopForNewTake();
        return;
    }

    for (int i = 0; i < loop.count; ++i)
    {
        const auto& note = loop.notes[static_cast<size_t> (i)];
        if (note.step != loopStep)
            continue;
        startVoice (DrumKit::sound (note.sound), note.pitch, note.volume, offset);
        pushEvent (EngineEvent::Type::LoopHit, note);
    }
}

void LoopPadEngine::clearLoopForNewTake() noexcept
{
    if (loopClearedForTake)
        return;
    loopClearedForTake = true;
    loop.clear();
    pushEvent (EngineEvent::Type::LoopCleared, {});
}

void LoopPadEngine::startVoice (const DrumRecipe& recipe, float pitch, float volume, int offset) noexcept
{
    DrumVoice* target = nullptr;
    for (auto& voice : voices)
        if (! voice.isActive())
        {
            target = &voice;
            break;
        }

    if (target == nullptr) // steal the oldest
    {
        target = &voices[0];
        for (auto& voice : voices)
            if (voice.getOrder() < target->getOrder())
                target = &voice;
        target->kill();
    }

    seedCounter = seedCounter * 1664525u + 1013904223u;
    target->start (recipe, pitch, volume, offset, sampleRate, seedCounter, ++voiceCounter);
}

void LoopPadEngine::pushEvent (EngineEvent::Type type, const LoopNote& note) noexcept
{
    if (numEvents < maxEventsPerBlock)
        events[static_cast<size_t> (numEvents++)] = { type, note };
}

} // namespace core
