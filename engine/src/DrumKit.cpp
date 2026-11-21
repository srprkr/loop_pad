#include "core/DrumKit.h"

namespace core
{

// Every number below comes from the prototype's Web Audio recipes (source_code.jsx:342-850 for
// the kit, :295-329 for the metronome) and ui/src/audio/webSynth.ts, which is a verbatim copy.
// Keep the order of the kit in step with ui/src/data/kit.ts.

namespace
{
    constexpr FilterSpec highPass (float hz)                 { return { FilterKind::HighPass, hz, 1.0f, 0.0f, 0.0f }; }
    constexpr FilterSpec lowPass (float hz, float qDb = 1.0f) { return { FilterKind::LowPass, hz, qDb, 0.0f, 0.0f }; }
    constexpr FilterSpec bandPass (float hz, float q)        { return { FilterKind::BandPass, hz, q, 0.0f, 0.0f }; }

    /** Oscillator with an optional exponential pitch sweep and an exponential decay to 0.001. */
    constexpr Layer tone (Wave wave, float freq, float freqEnd, float sweepTime, float gain, float decay, float stop,
                          FilterSpec filter = {})
    {
        Layer l;
        l.wave = wave;
        l.freqHz = freq;
        l.freqEndHz = freqEnd;
        l.freqSweepTime = sweepTime;
        l.filters = { filter, FilterSpec {} };
        l.gain = gain;
        l.decayTime = decay;
        l.stopTime = stop;
        return l;
    }

    /** White noise through up to two filters, with an exponential decay to 0.001. */
    constexpr Layer noise (float gain, float decay, float stop, FilterSpec first, FilterSpec second = {})
    {
        Layer l;
        l.wave = Wave::Noise;
        l.filters = { first, second };
        l.gain = gain;
        l.decayTime = decay;
        l.stopTime = stop;
        return l;
    }

    constexpr Layer scaledDecay (Layer l)
    {
        l.decayScalesWithPitch = true;
        return l;
    }

    constexpr Layer delayed (Layer l, float offset, float decayGain)
    {
        l.offset = offset;
        l.decayGain = decayGain;
        return l;
    }

    constexpr Layer withAttack (Layer l, float attackTime, float attackGain)
    {
        l.attackTime = attackTime;
        l.attackGain = attackGain;
        return l;
    }

    constexpr FilterSpec sweeping (FilterSpec f, float toHz, float time)
    {
        f.sweepToHz = toHz;
        f.sweepTime = time;
        return f;
    }

    constexpr DrumRecipe recipe (const char* id, const char* label, const char* category,
                                 Layer a, Layer b = {}, Layer c = {}, Layer d = {}, int numLayers = 0)
    {
        return { id, label, category, numLayers, { a, b, c, d } };
    }

    // Clap: three short bursts 12 ms apart, then the body, all through one band-pass.
    constexpr FilterSpec clapFilter = bandPass (1100.0f, 1.8f);
    constexpr Layer clapBurst (float offset) { return delayed (noise (0.5f, 0.015f, 0.02f, clapFilter), offset, 0.01f); }

    const std::array<DrumRecipe, 25> kit {{
        // Kicks & sub
        recipe ("punch_kick", "Punch Kick", "kick",
                tone (Wave::Sine, 160.0f, 45.0f, 0.08f, 1.0f, 0.24f, 0.26f),
                tone (Wave::Square, 250.0f, 40.0f, 0.02f, 0.4f, 0.025f, 0.03f), {}, {}, 2),
        recipe ("sub_808", "Sub 808", "kick",
                tone (Wave::Sine, 120.0f, 42.0f, 0.12f, 1.0f, 0.75f, 0.8f), {}, {}, {}, 1),
        recipe ("thud_kick", "Thud Kick", "kick",
                tone (Wave::Triangle, 130.0f, 38.0f, 0.14f, 1.0f, 0.32f, 0.35f), {}, {}, {}, 1),
        recipe ("click_kick", "Click Kick", "kick",
                tone (Wave::Sine, 220.0f, 50.0f, 0.06f, 1.0f, 0.18f, 0.2f), {}, {}, {}, 1),

        // Snares & claps
        recipe ("tight_snare", "Tight Snare", "snare",
                tone (Wave::Triangle, 190.0f, 75.0f, 0.08f, 0.9f, 0.12f, 0.14f),
                noise (0.7f, 0.18f, 0.2f, highPass (1500.0f)), {}, {}, 2),
        recipe ("fat_snare", "Fat Snare", "snare",
                tone (Wave::Sine, 160.0f, 65.0f, 0.12f, 1.0f, 0.22f, 0.25f),
                noise (0.8f, 0.26f, 0.28f, lowPass (4000.0f)), {}, {}, 2),
        recipe ("clap", "Clap", "snare",
                clapBurst (0.0f), clapBurst (0.012f), clapBurst (0.024f),
                // Body: starts at 36 ms, decays until 220 ms and stops at 250 ms after the trigger.
                delayed (noise (0.8f, 0.22f - 0.036f, 0.25f - 0.036f, clapFilter), 0.036f, 0.001f), 4),
        recipe ("rimshot", "Rimshot", "snare",
                tone (Wave::Sine, 780.0f, 420.0f, 0.03f, 0.8f, 0.045f, 0.05f),
                noise (0.6f, 0.025f, 0.03f, bandPass (3200.0f, 4.0f)), {}, {}, 2),

        // Hi-hats & cymbals
        recipe ("closed_hat", "Closed Hat", "hihat",
                scaledDecay (noise (0.7f, 0.06f, 0.08f, highPass (7000.0f))), {}, {}, {}, 1),
        recipe ("open_hat", "Open Hat", "hihat",
                scaledDecay (noise (0.65f, 0.38f, 0.4f, highPass (6000.0f), bandPass (8000.0f, 2.0f))), {}, {}, {}, 1),
        recipe ("pedal_hat", "Pedal Hat", "hihat",
                scaledDecay (noise (0.5f, 0.12f, 0.14f, highPass (5000.0f))), {}, {}, {}, 1),
        recipe ("splash", "Splash Cymbal", "perc",
                noise (0.7f, 0.7f, 0.75f, highPass (5000.0f)), {}, {}, {}, 1),
        recipe ("crash", "Crash Cymbal", "perc",
                noise (0.8f, 1.2f, 1.25f, highPass (4500.0f)), {}, {}, {}, 1),

        // Toms
        recipe ("high_tom", "High Tom", "tom",
                tone (Wave::Sine, 240.0f, 140.0f, 0.18f, 0.85f, 0.28f, 0.3f), {}, {}, {}, 1),
        recipe ("mid_tom", "Mid Tom", "tom",
                tone (Wave::Sine, 180.0f, 105.0f, 0.22f, 0.85f, 0.32f, 0.35f), {}, {}, {}, 1),
        recipe ("low_tom", "Low Tom", "tom",
                tone (Wave::Sine, 130.0f, 70.0f, 0.26f, 0.9f, 0.38f, 0.4f), {}, {}, {}, 1),
        recipe ("floor_tom", "Floor Tom", "tom",
                tone (Wave::Sine, 95.0f, 50.0f, 0.35f, 0.95f, 0.45f, 0.5f), {}, {}, {}, 1),

        // Auxiliary percussion
        recipe ("shaker", "Shaker", "perc",
                withAttack (scaledDecay (noise (0.01f, 0.09f, 0.1f, bandPass (5500.0f, 1.5f))), 0.015f, 0.45f), {}, {}, {}, 1),
        recipe ("tambourine", "Tambourine", "perc",
                noise (0.75f, 0.16f, 0.18f, highPass (7500.0f)), {}, {}, {}, 1),
        recipe ("cowbell", "Cowbell", "perc",
                // Two squares into one band-pass; the filter is linear, so each gets its own copy.
                tone (Wave::Square, 540.0f, 0.0f, 0.0f, 0.7f, 0.35f, 0.38f, bandPass (740.0f, 3.5f)),
                tone (Wave::Square, 800.0f, 0.0f, 0.0f, 0.7f, 0.35f, 0.38f, bandPass (740.0f, 3.5f)), {}, {}, 2),
        recipe ("woodblock", "Woodblock", "perc",
                tone (Wave::Sine, 950.0f, 500.0f, 0.04f, 0.8f, 0.06f, 0.07f), {}, {}, {}, 1),
        recipe ("agogo", "Agogo Bell", "perc",
                tone (Wave::Triangle, 1150.0f, 0.0f, 0.0f, 0.75f, 0.2f, 0.22f), {}, {}, {}, 1),
        recipe ("stick_click", "Stick Click", "perc",
                tone (Wave::Square, 1200.0f, 0.0f, 0.0f, 0.6f, 0.015f, 0.02f), {}, {}, {}, 1),

        // Synthesized FX
        recipe ("laser_fx", "Laser FX", "fx",
                tone (Wave::Saw, 1600.0f, 120.0f, 0.18f, 0.65f, 0.22f, 0.25f), {}, {}, {}, 1),
        recipe ("noise_drop", "Noise Drop FX", "fx",
                noise (0.75f, 0.48f, 0.5f, sweeping (lowPass (3500.0f, 4.0f), 100.0f, 0.45f)), {}, {}, {}, 1),
    }};

    // Metronome. Count-in clicks are higher and fall in pitch; the accent marks beat 1.
    const std::array<DrumRecipe, 4> clicks {{
        recipe ("count_in_accent", "Count-in (accent)", "click", tone (Wave::Sine, 2400.0f, 800.0f, 0.02f, 0.45f, 0.025f, 0.03f), {}, {}, {}, 1),
        recipe ("count_in", "Count-in", "click", tone (Wave::Sine, 2000.0f, 800.0f, 0.02f, 0.45f, 0.025f, 0.03f), {}, {}, {}, 1),
        recipe ("bar_accent", "Bar", "click", tone (Wave::Sine, 1600.0f, 0.0f, 0.0f, 0.35f, 0.035f, 0.04f), {}, {}, {}, 1),
        recipe ("beat", "Beat", "click", tone (Wave::Sine, 1000.0f, 0.0f, 0.0f, 0.35f, 0.035f, 0.04f), {}, {}, {}, 1),
    }};
} // namespace

namespace DrumKit
{
    int numSounds() noexcept { return static_cast<int> (kit.size()); }

    const DrumRecipe& sound (int index) noexcept
    {
        return kit[static_cast<size_t> (index < 0 || index >= numSounds() ? 0 : index)];
    }

    int findSound (std::string_view id) noexcept
    {
        for (int i = 0; i < numSounds(); ++i)
            if (id == kit[static_cast<size_t> (i)].id)
                return i;
        return -1;
    }

    const DrumRecipe& click (Click type) noexcept
    {
        return clicks[static_cast<size_t> (type)];
    }
} // namespace DrumKit

} // namespace core
