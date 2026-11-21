#pragma once

#include <array>
#include <cstdint>
#include <string_view>

namespace core
{

enum class Wave : uint8_t { Sine, Triangle, Square, Saw, Noise };
enum class FilterKind : uint8_t { None, LowPass, HighPass, BandPass };

/**
    One BiquadFilterNode. Frequencies are multiplied by the pitch ratio, then the start is
    clamped to at most 18 kHz and a sweep target to at least 20 Hz, as in the prototype.
*/
struct FilterSpec
{
    FilterKind kind = FilterKind::None;
    float freqHz = 0.0f;
    float q = 1.0f;         // Web Audio's default. dB for low/high-pass, linear for band-pass.
    float sweepToHz = 0.0f; // 0: fixed frequency
    float sweepTime = 0.0f; // exponential sweep ends here (seconds after the layer starts)
};

/**
    One source -> up to two filters -> gain envelope: one branch of the prototype's Web Audio
    graph for a sound. Times are seconds after the layer starts; the envelope follows Web Audio's
    setValueAtTime / linearRampToValueAtTime / exponentialRampToValueAtTime.
*/
struct Layer
{
    Wave wave = Wave::Sine;
    float freqHz = 0.0f;        // oscillator start frequency (x pitch)
    float freqEndHz = 0.0f;     // 0: constant frequency
    float freqSweepTime = 0.0f; // exponential sweep to freqEndHz ends here

    std::array<FilterSpec, 2> filters {};

    float offset = 0.0f;        // layer start, seconds after the trigger (clap bursts)
    float gain = 1.0f;          // gain when the layer starts
    float attackTime = 0.0f;    // > 0: linear ramp to attackGain first (shaker)
    float attackGain = 0.0f;
    float decayTime = 0.0f;     // exponential ramp to decayGain ends here
    float decayGain = 0.001f;
    bool decayScalesWithPitch = false; // hats & shaker: decayTime / max(0.5, pitch ratio)
    float stopTime = 0.0f;      // the source stops here
};

struct DrumRecipe
{
    const char* id;
    const char* label;
    const char* category;
    int numLayers;
    std::array<Layer, 4> layers;
};

/** The built-in kit (ids shared with ui/src/data/kit.ts) plus the metronome clicks. */
namespace DrumKit
{
    int numSounds() noexcept;
    const DrumRecipe& sound (int index) noexcept;

    /** Index of a kit sound, or -1. */
    int findSound (std::string_view id) noexcept;

    enum class Click { CountInAccent, CountIn, BarAccent, Beat };
    const DrumRecipe& click (Click type) noexcept;
}

} // namespace core
