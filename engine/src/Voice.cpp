#include "core/Voice.h"

#include <algorithm>
#include <cmath>

namespace core
{

namespace
{
    constexpr double halfPi = 1.57079632679489661923;
    constexpr float quickFadeSec = 0.0035f; // anti-click micro-fade
} // namespace

void Voice::start (const VoiceStartInfo& info, const GrainWindow& window, double newSampleRate, uint64_t newOrder)
{
    active = info.sample != nullptr && info.sample->numFrames() > 1;
    if (! active)
        return;

    note = info.note;
    order = newOrder;
    sampleRate = newSampleRate;
    velocityGain = info.gain;
    monoSource = info.sample->numChannels() < 2;

    reader = RegionReader (*info.sample, info.region);

    // Search ±12 ms of source audio for the best grain alignment, like the original WSOLA.
    const double searchRadius = std::min (0.4 * window.length * info.pitchRate, 0.012 * info.sample->sampleRate);
    player.start (reader, window, info.pitchRate, info.contentRate, searchRadius);

    quickFadeLength = std::max (1, static_cast<int> (quickFadeSec * sampleRate));
    quickFadeRemaining = -1;

    // Web Audio StereoPannerNode equal-power law.
    const float pan = std::clamp (info.pan, -1.0f, 1.0f);
    if (monoSource)
    {
        const double x = (pan + 1.0) * 0.5;
        panLeftGain = static_cast<float> (std::cos (x * halfPi));
        panRightGain = static_cast<float> (std::sin (x * halfPi));
    }
    else
    {
        const double x = pan <= 0.0f ? pan + 1.0 : pan;
        panToLeft = pan <= 0.0f;
        panLeftGain = static_cast<float> (std::cos (x * halfPi));
        panRightGain = static_cast<float> (std::sin (x * halfPi));
    }

    envelope.setSampleRate (sampleRate);
    envelope.reset();
    envelope.noteOn (info.attackSec, info.decaySec, info.sustainLevel);
    endFadeFrames = std::max (1.0, quickFadeSec * sampleRate * info.contentRate);

    highPassWasActive = lowPassWasActive = false;
    for (auto& section : highPassState) for (auto& s : section) s.reset();
    for (auto& section : lowPassState)  for (auto& s : section) s.reset();
}

bool Voice::isReleasing() const noexcept
{
    return quickFadeRemaining >= 0
        || envelope.getStage() == LinearAdsr::Stage::Release;
}

void Voice::release (float releaseSec) noexcept
{
    if (active)
        envelope.release (releaseSec);
}

void Voice::quickFade() noexcept
{
    if (! active || quickFadeRemaining >= 0)
        return;

    quickFadeRemaining = quickFadeLength;
}

float Voice::endFadeGain() const noexcept
{
    const double remaining = reader.framesRemaining (player.getContentPosition());
    return static_cast<float> (std::clamp (remaining / endFadeFrames, 0.0, 1.0));
}

float Voice::processFilters (float x, int channel, const VoiceRenderContext& context) noexcept
{
    if (context.highPass.active)
        for (int s = 0; s < context.highPass.numSections; ++s)
            x = highPassState[s][channel].process (x, context.highPass.sections[static_cast<size_t> (s)]);

    if (context.lowPass.active)
        for (int s = 0; s < context.lowPass.numSections; ++s)
            x = lowPassState[s][channel].process (x, context.lowPass.sections[static_cast<size_t> (s)]);

    return x;
}

void Voice::render (float* left, float* right, int numSamples, const VoiceRenderContext& context) noexcept
{
    if (! active)
        return;

    // A filter that was just switched on starts from silence rather than stale state.
    if (context.highPass.active && ! highPassWasActive)
        for (auto& section : highPassState) for (auto& s : section) s.reset();
    if (context.lowPass.active && ! lowPassWasActive)
        for (auto& section : lowPassState) for (auto& s : section) s.reset();

    highPassWasActive = context.highPass.active;
    lowPassWasActive = context.lowPass.active;

    for (int i = 0; i < numSamples; ++i)
    {
        if (reader.framesRemaining (player.getContentPosition()) <= 0.0)
        {
            active = false;
            return;
        }

        float l, r;
        player.next (l, r);

        float fade = endFadeGain();
        if (quickFadeRemaining >= 0)
        {
            if (quickFadeRemaining == 0)
            {
                active = false;
                return;
            }
            fade *= static_cast<float> (quickFadeRemaining--) / static_cast<float> (quickFadeLength);
        }

        const float env = envelope.next();
        if (! envelope.isActive())
        {
            active = false;
            return;
        }

        const float gain = env * velocityGain * fade;

        if (monoSource)
        {
            const float m = processFilters (l, 0, context) * gain;
            left[i] += m * panLeftGain;
            right[i] += m * panRightGain;
        }
        else
        {
            l = processFilters (l, 0, context) * gain;
            r = processFilters (r, 1, context) * gain;

            if (panToLeft)
            {
                left[i] += l + r * panLeftGain;
                right[i] += r * panRightGain;
            }
            else
            {
                left[i] += l * panLeftGain;
                right[i] += r + l * panRightGain;
            }
        }
    }
}

float Voice::getPlayheadFraction() const noexcept
{
    const auto frames = reader.getNumFrames();
    if (frames <= 1)
        return 0.0f;

    return static_cast<float> (reader.toSamplePosition (player.getContentPosition()) / static_cast<double> (frames - 1));
}

} // namespace core
