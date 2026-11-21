#pragma once

#include "DrumVoice.h"
#include "EngineParams.h"

#include <array>
#include <cstdint>

namespace core
{

/** One recorded hit: a snapshot of the pad when it was played (source_code.jsx:134-140). */
struct LoopNote
{
    int step = 0;      // 0..63
    int sound = 0;     // DrumKit sound index
    float pitch = 0.0f;
    float volume = 1.0f;
    char padKey = 0;   // keyboard key of the pad that played it, for the UI's flashes
};

/** The 4-bar loop. Fixed capacity, so the audio thread never allocates. */
struct Loop
{
    static constexpr int steps = 64;
    static constexpr int maxNotes = steps * 25;

    std::array<LoopNote, maxNotes> notes {};
    int count = 0;

    /** Adds a hit, replacing one of the same sound on the same step. */
    void add (const LoopNote& note) noexcept;
    void clear() noexcept { count = 0; }
};

/** Something the plugin asks the engine to do at a sample offset in the next block. */
struct EngineCommand
{
    enum class Type
    {
        Trigger,    // play a pad; recorded into the loop while recording
        Preview,    // play a sound without recording (inspector auditions)
        Record,     // REC: start the count-in, or stop while counting in / recording
        TogglePlay, // PLAY / PAUSE
        Stop
    };

    Type type = Type::Trigger;
    int sampleOffset = 0;
    int sound = 0;
    float pitch = 0.0f;
    float volume = 1.0f;
    char padKey = 0;
};

enum class TransportMode { Idle, CountIn, Recording, Playing };

/** Loop changes and playback hits, reported after each block for the plugin and UI. */
struct EngineEvent
{
    enum class Type { LoopCleared, NoteRecorded, LoopHit };

    Type type = Type::LoopHit;
    LoopNote note;
};

/** Snapshot of what the engine is doing, for the UI. Written once per block. */
struct EngineTelemetry
{
    float peakLeft = 0.0f, peakRight = 0.0f;
    TransportMode mode = TransportMode::Idle;
    int step = 0;              // current 16th: 0..63, or -12..-1 during the count-in
    uint32_t recordBeat = 0;   // counts metronome beats while recording
    double bpm = 120.0;        // tempo the transport runs at
    bool hostSynced = false;   // true while following the host's tempo
    int loopLength = 0;        // hits in the loop
};

/**
    The Loop Pad instrument: a pool of DrumVoices, master volume / mute, a soft clipper and the
    loop recorder, independent of any plugin framework.

    Transport (source_code.jsx:910-1046):
      REC  -> 3-beat count-in (steps -12..-1) -> one recording pass of 64 sixteenth steps ->
              loops the recording. Hits snap to the nearest 16th; a hit in the last half step of
              the count-in lands on step 0. A new take replaces the loop once it starts.
      PLAY -> loops from step 0; PAUSE stops. The metronome clicks on quarter notes (accent on
              each bar) during the count-in, recording and playback while it is enabled.
    Tempo is the BPM parameter, or the host's tempo while the host transport plays.

    Thread rules: everything here runs on the audio thread except prepare(). Nothing in
    process() allocates or locks.
*/
class LoopPadEngine
{
public:
    static constexpr int maxVoices = 32;
    static constexpr int countInSteps = 12;
    static constexpr int maxEventsPerBlock = 512;

    void prepare (double sampleRate, int maxBlockSize);

    void setParams (const EngineParams& newParams) noexcept { params = newParams; }

    /** Replaces the loop (restoring a saved session). */
    void setLoop (const Loop& newLoop) noexcept { loop = newLoop; }
    const Loop& getLoop() const noexcept { return loop; }

    /** Renders numSamples of stereo audio, replacing the buffer contents. Commands must be sorted by offset. */
    void process (float* left, float* right, int numSamples, const TransportInfo& transport,
                  const EngineCommand* commands, int numCommands) noexcept;

    const EngineTelemetry& getTelemetry() const noexcept { return telemetry; }

    /** Events from the last process() call. */
    const EngineEvent* getEvents() const noexcept { return events.data(); }
    int getNumEvents() const noexcept { return numEvents; }

    TransportMode getMode() const noexcept;

    /** Transport position in 16th steps since the start of the loop (negative during the count-in). */
    double getPosition() const noexcept { return position; }

private:
    void handleCommand (const EngineCommand& command, int offset) noexcept;
    void fireStep (int64_t step, int offset) noexcept;
    void recordHit (const EngineCommand& command) noexcept;
    void startTransport (bool withRecording) noexcept;
    void clearLoopForNewTake() noexcept;
    void startVoice (const DrumRecipe& recipe, float pitch, float volume, int offset) noexcept;
    void pushEvent (EngineEvent::Type type, const LoopNote& note) noexcept;

    double sampleRate = 48000.0;
    EngineParams params;

    std::array<DrumVoice, maxVoices> voices {};
    uint64_t voiceCounter = 0;
    uint32_t seedCounter = 0x12345678u;

    // Transport
    bool running = false;
    bool recordRun = false;          // this run started with REC
    bool loopClearedForTake = false;
    // Position in steps = anchorPosition + samplesSinceAnchor * stepsPerSample. Re-anchored only
    // when the tempo changes, so it never drifts the way a running sum would.
    double position = 0.0;           // in steps, at the current sample
    double anchorPosition = 0.0;
    int64_t samplesSinceAnchor = 0;
    int64_t nextStep = 0;            // next step to fire
    double stepsPerSample = 0.0;
    uint32_t recordBeat = 0;
    Loop loop;

    std::array<EngineEvent, maxEventsPerBlock> events {};
    int numEvents = 0;

    float smoothedGain = 0.85f;
    float gainCoefficient = 0.0f;
    EngineTelemetry telemetry;
};

const char* toString (TransportMode mode) noexcept;

} // namespace core
