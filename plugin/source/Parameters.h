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
    Everything else (host automation, session state, the UI bridge) picks it up.

    Per-pad pitch and volume are not parameters: there are three pad sets (59 pads), so they are
    saved as plugin state with the rest of the kit.
*/
namespace ParamIds
{
    inline constexpr const char* masterVolume = "masterVolume";
    inline constexpr const char* mute         = "mute";
    inline constexpr const char* bpm          = "bpm";
    inline constexpr const char* metronome    = "metronome";
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
