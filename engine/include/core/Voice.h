#pragma once

#include "Biquad.h"
#include "Envelope.h"
#include "StretchPlayer.h"

#include <cstdint>

namespace core
{

/** Per-block settings shared by every voice. */
struct VoiceRenderContext
{
    double sampleRate = 44100.0;
    FilterDesign highPass;
    FilterDesign lowPass;
};

/** Everything needed to start a voice, worked out by the engine at trigger time. */
struct VoiceStartInfo
{
    int note = 60;
    const SampleData* sample = nullptr;
    PlaybackRegion region;
    double pitchRate = 1.0;   // source frames per output sample (pitch)
    double contentRate = 1.0; // source frames per output sample (speed)
    float gain = 1.0f;        // velocity gain (master gain is applied by the engine)
    float pan = 0.0f;         // -1..1

    float attackSec = 0.001f, decaySec = 0.8f, sustainLevel = 0.8f;
};

/** One playing note: stretch player -> high-pass -> low-pass -> ADSR -> pan. */
class Voice
{
public:
    void start (const VoiceStartInfo& info, const GrainWindow& window, double sampleRate, uint64_t order);

    /** Moves to the release stage using releaseSec. */
    void release (float releaseSec) noexcept;

    /** Very short (3.5 ms) fade to silence, for hard stops such as choke groups. */
    void quickFade() noexcept;

    void kill() noexcept { active = false; }

    /** Adds this voice's output to the buffers. */
    void render (float* left, float* right, int numSamples, const VoiceRenderContext& context) noexcept;

    bool isActive() const noexcept { return active; }
    bool isReleasing() const noexcept;
    int getNote() const noexcept { return note; }
    uint64_t getOrder() const noexcept { return order; }

    /** Playhead as a fraction (0..1) of the sample, for the waveform display. */
    float getPlayheadFraction() const noexcept;

private:
    float processFilters (float x, int channel, const VoiceRenderContext& context) noexcept;
    float endFadeGain() const noexcept;

    bool active = false;
    int note = 0;
    uint64_t order = 0;
    double sampleRate = 44100.0;

    RegionReader reader;
    StretchPlayer player;
    LinearAdsr envelope;

    float velocityGain = 1.0f;
    float panLeftGain = 1.0f, panRightGain = 1.0f;
    bool panToLeft = true; // stereo sources: which side receives the cross-fed channel
    bool monoSource = true;

    int quickFadeLength = 1;
    int quickFadeRemaining = -1; // -1 = not fading

    double endFadeFrames = 1.0;

    bool highPassWasActive = false, lowPassWasActive = false;
    BiquadState highPassState[2][2]; // [section][channel]
    BiquadState lowPassState[2][2];
};

} // namespace core
