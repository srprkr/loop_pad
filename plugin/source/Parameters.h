#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <core/EngineParams.h>

/**
    Parameter IDs. The React UI uses the same strings (ui/src/state/parameterIds.ts).

    Adding a parameter touches four places:
      1. an ID here,
      2. its definition in createParameterLayout() (Parameters.cpp),
      3. a field in core::EngineParams plus a line in ParameterSnapshot (Parameters.cpp),
      4. the ID in ui/src/state/parameterIds.ts and its default in ui/src/state/defaults.ts.
    Everything else (host automation, presets, session state, the UI bridge) picks it up.
*/
namespace ParamIds
{
    inline constexpr const char* masterGain           = "masterGain";

    inline constexpr const char* playbackMode         = "playbackMode";
    inline constexpr const char* startPos             = "startPos";
    inline constexpr const char* endPos               = "endPos";
    inline constexpr const char* loopStartPos         = "loopStartPos";
    inline constexpr const char* loopEndPos           = "loopEndPos";
    inline constexpr const char* loopCrossfade        = "loopCrossfade";
    inline constexpr const char* rootNote             = "rootNote";
    inline constexpr const char* preserveSpeed        = "preserveSpeed";
    inline constexpr const char* tempoSync            = "tempoSync";
    inline constexpr const char* sampleBpm            = "sampleBpm";

    inline constexpr const char* attack               = "attack";
    inline constexpr const char* decay                = "decay";
    inline constexpr const char* sustain              = "sustain";
    inline constexpr const char* release              = "release";

    inline constexpr const char* hpfEnabled           = "hpfEnabled";
    inline constexpr const char* hpfCutoff            = "hpfCutoff";
    inline constexpr const char* hpfResonance         = "hpfResonance";
    inline constexpr const char* hpfSlope             = "hpfSlope";
    inline constexpr const char* lpfEnabled           = "lpfEnabled";
    inline constexpr const char* lpfCutoff            = "lpfCutoff";
    inline constexpr const char* lpfResonance         = "lpfResonance";
    inline constexpr const char* lpfSlope             = "lpfSlope";
} // namespace ParamIds

juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();

/** Lock-free reader that turns the current parameter values into an engine snapshot. */
class ParameterSnapshot
{
public:
    explicit ParameterSnapshot (juce::AudioProcessorValueTreeState& state);
    ~ParameterSnapshot();

    core::EngineParams read() const noexcept;

private:
    struct Raw;
    std::unique_ptr<Raw> raw;
};
