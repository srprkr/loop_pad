#pragma once

#include "EngineParams.h"
#include "SampleData.h"
#include "Voice.h"

#include <array>
#include <cstdint>

namespace core
{

struct NoteEvent
{
    enum class Type { NoteOn, NoteOff, AllNotesOff };

    Type type = Type::NoteOn;
    int sampleOffset = 0;
    int note = 60;
    int velocity = 100;
};

/** Snapshot of what the engine is doing, for the UI. Written once per block. */
struct EngineTelemetry
{
    static constexpr int maxVoices = 32;

    struct VoiceInfo
    {
        bool active = false;
        float position = 0.0f; // fraction of the sample it is playing
    };

    std::array<VoiceInfo, maxVoices> voices {};
    float peakLeft = 0.0f, peakRight = 0.0f;
    double hostBpm = 120.0;
};

/**
    A polyphonic sampler, independent of any plugin framework: one sample, played across the
    keyboard, with a start/end (or loop) region, tempo sync, ADSR and two filters.

    This is the template's example instrument. Replace or extend it for your own product; the
    building blocks it uses (StretchPlayer, RegionReader, LinearAdsr, Biquad, StepClock) are
    independent of it.

    Thread rules: everything here runs on the audio thread except prepare(). The caller hands
    over samples and parameters by value or shared pointer; nothing in process() allocates or locks.
*/
class SamplerEngine
{
public:
    static constexpr int maxVoices = EngineTelemetry::maxVoices;

    void prepare (double sampleRate, int maxBlockSize);

    /** Swaps the sample. Silences every voice. */
    void setSample (SamplePtr newSample) noexcept;

    void setParams (const EngineParams& newParams) noexcept { params = newParams; }

    /** Renders numSamples of stereo audio, replacing the buffer contents. Events must be sorted by offset. */
    void process (float* left, float* right, int numSamples, const TransportInfo& transport,
                  const NoteEvent* events, int numEvents) noexcept;

    const EngineTelemetry& getTelemetry() const noexcept { return telemetry; }

private:
    void handleEvent (const NoteEvent& event) noexcept;

    void triggerNote (int note, int velocity) noexcept;
    void releaseNote (int note) noexcept;
    void releaseAllNotes() noexcept;

    bool computeRates (int note, const SampleData& sample, double& pitchRate, double& contentRate) const noexcept;
    Voice& allocateVoice() noexcept;
    void renderVoices (float* left, float* right, int numSamples) noexcept;
    void updateFilters (int numSamples) noexcept;
    void writeTelemetry() noexcept;

    double sampleRate = 44100.0;
    EngineParams params;
    TransportInfo transport;
    SamplePtr sample;

    GrainWindow grainWindow;
    std::array<Voice, maxVoices> voices {};
    uint64_t voiceCounter = 0;
    VoiceRenderContext renderContext;
    float smoothedHighPassCutoff = 20.0f, smoothedLowPassCutoff = 20000.0f;
    float smoothedMasterGain = 1.0f;

    EngineTelemetry telemetry;
};

} // namespace core
