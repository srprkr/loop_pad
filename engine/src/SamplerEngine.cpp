#include "core/SamplerEngine.h"

#include <algorithm>
#include <cmath>

namespace core
{

namespace
{
    constexpr float filterSmoothingSec = 0.02f;

    float velocityToGain (int velocity) noexcept
    {
        return static_cast<float> (std::pow (std::clamp (velocity, 0, 127) / 127.0, 1.25));
    }
} // namespace

//==============================================================================
void SamplerEngine::prepare (double newSampleRate, int /*maxBlockSize*/)
{
    sampleRate = newSampleRate > 0.0 ? newSampleRate : 44100.0;
    grainWindow.build (sampleRate);

    for (auto& voice : voices)
        voice.kill();

    renderContext.sampleRate = sampleRate;
    smoothedHighPassCutoff = params.highPass.cutoffHz;
    smoothedLowPassCutoff = params.lowPass.cutoffHz;
    smoothedMasterGain = params.masterGain;
}

void SamplerEngine::setSample (SamplePtr newSample) noexcept
{
    for (auto& voice : voices)
        voice.kill();

    sample = std::move (newSample);
}

//==============================================================================
void SamplerEngine::process (float* left, float* right, int numSamples, const TransportInfo& newTransport,
                             const NoteEvent* events, int numEvents) noexcept
{
    std::fill (left, left + numSamples, 0.0f);
    std::fill (right, right + numSamples, 0.0f);

    transport = newTransport;
    if (transport.bpm <= 0.0)
        transport.bpm = 120.0;

    updateFilters (numSamples);

    // Split the block at every MIDI event so notes start sample-accurately.
    int position = 0;
    int eventIndex = 0;

    for (;;)
    {
        while (eventIndex < numEvents && events[eventIndex].sampleOffset <= position)
            handleEvent (events[eventIndex++]);

        if (position >= numSamples)
            break;

        int next = numSamples;
        if (eventIndex < numEvents)
            next = std::min (next, std::max (position + 1, events[eventIndex].sampleOffset));

        renderVoices (left + position, right + position, next - position);
        position = next;
    }

    // Master gain, ramped across the block to avoid zipper noise.
    const float startGain = smoothedMasterGain;
    const float endGain = params.masterGain;
    float peakLeft = 0.0f, peakRight = 0.0f;

    for (int i = 0; i < numSamples; ++i)
    {
        const float gain = startGain + (endGain - startGain) * (static_cast<float> (i + 1) / static_cast<float> (numSamples));
        left[i] *= gain;
        right[i] *= gain;
        peakLeft = std::max (peakLeft, std::abs (left[i]));
        peakRight = std::max (peakRight, std::abs (right[i]));
    }
    smoothedMasterGain = endGain;

    telemetry.peakLeft = peakLeft;
    telemetry.peakRight = peakRight;
    writeTelemetry();
}

//==============================================================================
void SamplerEngine::handleEvent (const NoteEvent& event) noexcept
{
    switch (event.type)
    {
        case NoteEvent::Type::NoteOn:
            if (event.velocity > 0)
                triggerNote (event.note, event.velocity);
            else
                releaseNote (event.note);
            break;

        case NoteEvent::Type::NoteOff:
            releaseNote (event.note);
            break;

        case NoteEvent::Type::AllNotesOff:
            releaseAllNotes();
            break;
    }
}

//==============================================================================
bool SamplerEngine::computeRates (int note, const SampleData& data, double& pitchRate, double& contentRate) const noexcept
{
    if (data.sampleRate <= 0.0 || sampleRate <= 0.0)
        return false;

    const double pitch = std::pow (2.0, (note - params.rootNote) / 12.0);
    const double tempoFactor = (params.tempoSync && params.sampleBpm > 0.0f)
                                   ? transport.bpm / static_cast<double> (params.sampleBpm)
                                   : 1.0;

    // Preserve Speed: every key plays at the same tempo, only the pitch changes.
    const double speed = params.preserveSpeed ? tempoFactor : pitch * tempoFactor;
    const double sourceToOutput = data.sampleRate / sampleRate;

    pitchRate = pitch * sourceToOutput;
    contentRate = speed * sourceToOutput;
    return true;
}

void SamplerEngine::triggerNote (int note, int velocity) noexcept
{
    if (sample == nullptr || sample->numFrames() < 2)
        return;

    note = std::clamp (note, 0, 127);

    // Retriggering a note releases the one already sounding on it.
    releaseNote (note);

    const SampleData& data = *sample;
    VoiceStartInfo info;
    if (! computeRates (note, data, info.pitchRate, info.contentRate))
        return;

    const double lastFrame = static_cast<double> (data.numFrames() - 1);

    info.note = note;
    info.sample = &data;
    info.gain = velocityToGain (velocity);
    info.attackSec = params.attackSec;
    info.decaySec = params.decaySec;
    info.sustainLevel = params.sustainLevel;

    info.region.start = params.startPos * lastFrame;
    info.region.end = std::max (info.region.start + 0.01 * data.sampleRate, params.endPos * lastFrame);
    info.region.looping = params.playbackMode == PlaybackMode::Loop;
    info.region.loopStart = params.loopStartPos * lastFrame;
    info.region.loopEnd = params.loopEndPos * lastFrame;
    info.region.crossfade = std::max (0.005f, params.loopCrossfadeSec) * data.sampleRate;

    allocateVoice().start (info, grainWindow, sampleRate, ++voiceCounter);
}

void SamplerEngine::releaseNote (int note) noexcept
{
    for (auto& voice : voices)
        if (voice.isActive() && ! voice.isReleasing() && voice.getNote() == note)
            voice.release (params.releaseSec);
}

void SamplerEngine::releaseAllNotes() noexcept
{
    for (auto& voice : voices)
        if (voice.isActive() && ! voice.isReleasing())
            voice.release (params.releaseSec);
}

Voice& SamplerEngine::allocateVoice() noexcept
{
    Voice* oldestReleasing = nullptr;
    Voice* oldest = nullptr;

    for (auto& voice : voices)
    {
        if (! voice.isActive())
            return voice;

        if (voice.isReleasing() && (oldestReleasing == nullptr || voice.getOrder() < oldestReleasing->getOrder()))
            oldestReleasing = &voice;

        if (oldest == nullptr || voice.getOrder() < oldest->getOrder())
            oldest = &voice;
    }

    return oldestReleasing != nullptr ? *oldestReleasing : *oldest;
}

//==============================================================================
void SamplerEngine::updateFilters (int numSamples) noexcept
{
    // Glide cutoffs exponentially (in log-frequency) so automation and knob moves don't zipper.
    const float amount = 1.0f - std::exp (-static_cast<float> (numSamples) / (filterSmoothingSec * static_cast<float> (sampleRate)));

    const auto glide = [amount] (float current, float target)
    {
        current = std::max (current, 1.0f);
        return current * std::pow (std::max (target, 1.0f) / current, amount);
    };

    smoothedHighPassCutoff = glide (smoothedHighPassCutoff, params.highPass.cutoffHz);
    smoothedLowPassCutoff = glide (smoothedLowPassCutoff, params.lowPass.cutoffHz);

    FilterParams highPass = params.highPass;
    FilterParams lowPass = params.lowPass;
    highPass.cutoffHz = smoothedHighPassCutoff;
    lowPass.cutoffHz = smoothedLowPassCutoff;

    renderContext.sampleRate = sampleRate;
    renderContext.highPass = designFilter (FilterType::HighPass, highPass, sampleRate);
    renderContext.lowPass = designFilter (FilterType::LowPass, lowPass, sampleRate);
}

void SamplerEngine::renderVoices (float* left, float* right, int numSamples) noexcept
{
    for (auto& voice : voices)
        voice.render (left, right, numSamples, renderContext);
}

void SamplerEngine::writeTelemetry() noexcept
{
    for (size_t i = 0; i < voices.size(); ++i)
    {
        const auto& voice = voices[i];
        auto& info = telemetry.voices[i];
        info.active = voice.isActive();
        info.position = info.active ? voice.getPlayheadFraction() : 0.0f;
    }

    telemetry.hostBpm = transport.bpm;
}

} // namespace core
