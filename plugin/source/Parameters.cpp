#include "Parameters.h"

using namespace juce;
using APVTS = AudioProcessorValueTreeState;

namespace
{
    ParameterID id (const char* name) { return { name, 1 }; }

    auto percent()
    {
        return AudioParameterFloatAttributes().withStringFromValueFunction (
            [] (float v, int) { return String (roundToInt (v * 100.0f)) + "%"; });
    }
} // namespace

APVTS::ParameterLayout createParameterLayout()
{
    APVTS::ParameterLayout layout;

    // Ranges and defaults follow the prototype (source_code.jsx:212-217).
    layout.add (std::make_unique<AudioParameterFloat> (id (ParamIds::masterVolume), "Volume", NormalisableRange<float> { 0.0f, 1.0f }, 0.85f, percent()),
                std::make_unique<AudioParameterBool> (id (ParamIds::mute), "Mute", false),
                std::make_unique<AudioParameterInt> (id (ParamIds::bpm), "Tempo", 60, 200, 120,
                                                     AudioParameterIntAttributes().withLabel ("BPM")),
                std::make_unique<AudioParameterBool> (id (ParamIds::metronome), "Metronome", true));
    return layout;
}

//==============================================================================
struct ParameterSnapshot::Raw
{
    explicit Raw (APVTS& s) : state (s) {}

    const std::atomic<float>& get (const char* paramId) const
    {
        auto* value = state.getRawParameterValue (paramId);
        jassert (value != nullptr);
        return *value;
    }

    APVTS& state;

    const std::atomic<float>& masterVolume = get (ParamIds::masterVolume);
    const std::atomic<float>& mute = get (ParamIds::mute);
    const std::atomic<float>& bpm = get (ParamIds::bpm);
    const std::atomic<float>& metronome = get (ParamIds::metronome);
};

ParameterSnapshot::ParameterSnapshot (APVTS& state) : raw (std::make_unique<Raw> (state)) {}
ParameterSnapshot::~ParameterSnapshot() = default;

core::EngineParams ParameterSnapshot::read() const noexcept
{
    const auto f = [] (const std::atomic<float>& v) { return v.load (std::memory_order_relaxed); };

    const auto& r = *raw;
    core::EngineParams p;
    p.masterVolume = f (r.masterVolume);
    p.mute = f (r.mute) >= 0.5f;
    p.bpm = f (r.bpm);
    p.metronome = f (r.metronome) >= 0.5f;
    return p;
}
