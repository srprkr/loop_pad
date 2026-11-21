#include "core/DrumVoice.h"

#include <algorithm>
#include <cmath>

namespace core
{

namespace
{
    constexpr double twoPi = 6.28318530717958647692;
    constexpr int filterUpdateInterval = 16; // samples between coefficient updates of a sweeping filter
    constexpr double maxFilterHz = 18000.0;  // the prototype's Math.min(18000, ...)
    constexpr double minFilterHz = 20.0;     // ... and Math.max(20, ...) for sweep targets

    int64_t toSamples (double seconds, double sampleRate) noexcept
    {
        return static_cast<int64_t> (std::llround (std::max (0.0, seconds) * sampleRate));
    }

    /** Polynomial band-limited step, to remove aliasing from the square and saw edges. */
    double polyBlep (double t, double dt) noexcept
    {
        if (t < dt)
        {
            t /= dt;
            return t + t - t * t - 1.0;
        }
        if (t > 1.0 - dt)
        {
            t = (t - 1.0) / dt;
            return t * t + t + t + 1.0;
        }
        return 0.0;
    }
} // namespace

void DrumVoice::start (const DrumRecipe& recipe, float pitchSemitones, float newVolume, int delaySamples,
                       double newSampleRate, uint32_t seed, uint64_t newOrder) noexcept
{
    sampleRate = newSampleRate;
    volume = newVolume;
    noiseState = seed != 0 ? seed : 0x9e3779b9u;
    order = newOrder;
    position = -static_cast<int64_t> (std::max (0, delaySamples));
    endSample = 0;
    numLayers = std::clamp (recipe.numLayers, 0, static_cast<int> (layers.size()));

    const double pitch = std::pow (2.0, static_cast<double> (pitchSemitones) / 12.0);

    for (int i = 0; i < numLayers; ++i)
    {
        const Layer& spec = recipe.layers[static_cast<size_t> (i)];
        LayerState& layer = layers[static_cast<size_t> (i)];

        layer.wave = spec.wave;
        layer.startSample = toSamples (spec.offset, sampleRate);
        layer.stopSample = layer.startSample + toSamples (spec.stopTime, sampleRate);
        endSample = std::max (endSample, layer.stopSample);
        layer.phase = 0.0;

        // Pitch sweep (osc.frequency.exponentialRampToValueAtTime).
        layer.freq = spec.freqHz * pitch;
        layer.freqRatio = 1.0;
        layer.freqSweepSamples = 0;
        if (spec.freqEndHz > 0.0f && spec.freqSweepTime > 0.0f && layer.freq > 0.0)
        {
            layer.freqSweepSamples = std::max<int64_t> (1, toSamples (spec.freqSweepTime, sampleRate));
            layer.freqRatio = std::pow (spec.freqEndHz * pitch / layer.freq, 1.0 / static_cast<double> (layer.freqSweepSamples));
        }

        // Gain envelope.
        const double decayTime = spec.decayScalesWithPitch ? spec.decayTime / std::max (0.5, pitch) : spec.decayTime;
        layer.attackEnd = spec.attackTime > 0.0f ? std::max<int64_t> (1, toSamples (spec.attackTime, sampleRate)) : 0;
        layer.decayEnd = toSamples (decayTime, sampleRate);
        layer.gain = spec.gain;
        layer.decayStartGain = spec.attackTime > 0.0f ? spec.attackGain : spec.gain;
        layer.gainStep = layer.attackEnd > 0 ? (spec.attackGain - spec.gain) / static_cast<double> (layer.attackEnd) : 0.0;
        layer.decayGain = spec.decayGain;
        layer.gainRatio = layer.decayEnd > layer.attackEnd && layer.decayStartGain > 0.0
                              ? std::pow (layer.decayGain / layer.decayStartGain, 1.0 / static_cast<double> (layer.decayEnd - layer.attackEnd))
                              : 1.0;

        // Filters.
        layer.numFilters = 0;
        for (const auto& f : spec.filters)
        {
            if (f.kind == FilterKind::None)
                continue;

            FilterState& filter = layer.filters[static_cast<size_t> (layer.numFilters++)];
            filter.kind = f.kind;
            filter.q = f.q;
            filter.freq = std::min (maxFilterHz, f.freqHz * pitch);
            filter.sweepRatio = 1.0;
            filter.sweepUpdatesLeft = 0;
            if (f.sweepToHz > 0.0f && f.sweepTime > 0.0f)
            {
                const double target = std::max (minFilterHz, f.sweepToHz * pitch);
                const int64_t sweepSamples = std::max<int64_t> (filterUpdateInterval, toSamples (f.sweepTime, sampleRate));
                filter.sweepUpdatesLeft = sweepSamples / filterUpdateInterval;
                filter.sweepRatio = std::pow (target / filter.freq, 1.0 / static_cast<double> (filter.sweepUpdatesLeft));
            }
            filter.state.reset();
            updateFilter (filter);
        }
    }

    active = numLayers > 0;
}

void DrumVoice::updateFilter (FilterState& filter) noexcept
{
    switch (filter.kind)
    {
        case FilterKind::LowPass:  filter.coeffs = designLowPass (filter.freq, filter.q, sampleRate); break;
        case FilterKind::HighPass: filter.coeffs = designHighPass (filter.freq, filter.q, sampleRate); break;
        case FilterKind::BandPass: filter.coeffs = designBandPass (filter.freq, filter.q, sampleRate); break;
        case FilterKind::None: break;
    }
}

float DrumVoice::nextSource (LayerState& layer) noexcept
{
    if (layer.wave == Wave::Noise)
    {
        // xorshift32 white noise in [-1, 1)
        noiseState ^= noiseState << 13;
        noiseState ^= noiseState >> 17;
        noiseState ^= noiseState << 5;
        return static_cast<float> (static_cast<double> (noiseState) / 2147483648.0 - 1.0);
    }

    const double dt = std::min (0.5, layer.freq / sampleRate);
    const double t = layer.phase;
    double value = 0.0;

    switch (layer.wave)
    {
        case Wave::Sine:     value = std::sin (twoPi * t); break;
        case Wave::Triangle: value = 1.0 - 4.0 * std::abs (std::fmod (t + 0.25, 1.0) - 0.5); break; // starts at 0, rising
        case Wave::Saw:      value = 2.0 * t - 1.0 - polyBlep (t, dt); break;
        case Wave::Square:   value = (t < 0.5 ? 1.0 : -1.0) + polyBlep (t, dt) - polyBlep (std::fmod (t + 0.5, 1.0), dt); break;
        case Wave::Noise:    break;
    }

    layer.phase += dt;
    if (layer.phase >= 1.0)
        layer.phase -= 1.0;
    return static_cast<float> (value);
}

void DrumVoice::render (float* out, int numSamples) noexcept
{
    if (! active)
        return;

    for (int i = 0; i < numSamples; ++i, ++position)
    {
        if (position < 0)
            continue;
        if (position >= endSample)
        {
            active = false;
            return;
        }

        float sum = 0.0f;
        for (int l = 0; l < numLayers; ++l)
        {
            LayerState& layer = layers[static_cast<size_t> (l)];
            if (position < layer.startSample || position >= layer.stopSample)
                continue;

            const int64_t local = position - layer.startSample;

            // Sweeping filters move in small exponential steps.
            if (local > 0 && local % filterUpdateInterval == 0)
                for (int f = 0; f < layer.numFilters; ++f)
                {
                    FilterState& filter = layer.filters[static_cast<size_t> (f)];
                    if (filter.sweepUpdatesLeft > 0)
                    {
                        --filter.sweepUpdatesLeft;
                        filter.freq *= filter.sweepRatio;
                        updateFilter (filter);
                    }
                }

            float x = nextSource (layer);
            if (local < layer.freqSweepSamples)
                layer.freq *= layer.freqRatio;

            for (int f = 0; f < layer.numFilters; ++f)
            {
                FilterState& filter = layer.filters[static_cast<size_t> (f)];
                x = filter.state.process (x, filter.coeffs);
            }

            double g;
            if (local < layer.attackEnd)
            {
                g = layer.gain;
                layer.gain += layer.gainStep;
            }
            else if (local < layer.decayEnd)
            {
                if (local == layer.attackEnd)
                    layer.gain = layer.decayStartGain;
                g = layer.gain;
                layer.gain *= layer.gainRatio;
            }
            else
            {
                g = layer.decayGain;
            }

            sum += x * static_cast<float> (g);
        }

        out[i] += sum * volume;
    }
}

} // namespace core
