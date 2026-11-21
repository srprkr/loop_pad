#pragma once

#include "Biquad.h"
#include "DrumKit.h"

#include <array>
#include <cstdint>

namespace core
{

/**
    Plays one DrumRecipe in real time: the C++ equivalent of the prototype building and starting
    a Web Audio graph for a pad hit. Pitch scales the recipe's frequencies (it doesn't resample).
    Allocation-free; everything is set up in start().
*/
class DrumVoice
{
public:
    /**
        Starts the voice `delaySamples` into the next render() call (sample-accurate triggering
        within a block). `order` orders voices by age for stealing.
    */
    void start (const DrumRecipe& recipe, float pitchSemitones, float volume, int delaySamples,
                double sampleRate, uint32_t seed, uint64_t order) noexcept;

    /** Adds the voice to `out` (mono). */
    void render (float* out, int numSamples) noexcept;

    /** Stops at once. Voice stealing calls this; the drum sounds are short, so it isn't audible. */
    void kill() noexcept { active = false; }

    bool isActive() const noexcept { return active; }
    uint64_t getOrder() const noexcept { return order; }

private:
    struct FilterState
    {
        FilterKind kind = FilterKind::None;
        double q = 1.0;
        double freq = 0.0, sweepRatio = 1.0; // multiplicative step per coefficient update
        int64_t sweepUpdatesLeft = 0;
        BiquadCoeffs coeffs;
        BiquadState state;
    };

    struct LayerState
    {
        Wave wave = Wave::Sine;
        int64_t startSample = 0, stopSample = 0;      // relative to the trigger

        double phase = 0.0;
        double freq = 0.0, freqRatio = 1.0;          // Hz, per-sample multiplier during the sweep
        int64_t freqSweepSamples = 0;

        // Envelope: [0, attackEnd) linear, [attackEnd, decayEnd) exponential, then decayGain.
        double gain = 0.0, gainStep = 0.0, gainRatio = 1.0;
        int64_t attackEnd = 0, decayEnd = 0;
        double decayStartGain = 0.0, decayGain = 0.001;

        std::array<FilterState, 2> filters {};
        int numFilters = 0;
    };

    void updateFilter (FilterState& filter) noexcept;
    float nextSource (LayerState& layer) noexcept;

    std::array<LayerState, 4> layers {};
    int numLayers = 0;
    int64_t position = 0;     // samples since the trigger (negative while waiting for the delay)
    int64_t endSample = 0;
    double sampleRate = 48000.0;
    float volume = 1.0f;
    uint32_t noiseState = 1;
    uint64_t order = 0;
    bool active = false;
};

} // namespace core
