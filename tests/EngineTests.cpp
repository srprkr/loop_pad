// Behavioural tests for the DSP engine. Plain C++, no test framework required:
// each TEST registers itself, main() runs them all and returns non-zero on failure.

#include "core/Biquad.h"
#include "core/DrumKit.h"
#include "core/DrumVoice.h"
#include "core/LoopPadEngine.h"
#include "core/StepClock.h"

#include <chrono>
#include <cmath>
#include <complex>
#include <cstdio>
#include <functional>
#include <string>
#include <vector>

using namespace core;

//==============================================================================
namespace
{
    struct TestCase { const char* name; std::function<void()> body; };
    std::vector<TestCase>& registry() { static std::vector<TestCase> tests; return tests; }
    int failures = 0;

    struct Registrar
    {
        Registrar (const char* name, std::function<void()> body) { registry().push_back ({ name, std::move (body) }); }
    };

    void check (bool condition, const char* expression, const char* file, int line, const std::string& detail = {})
    {
        if (condition)
            return;
        ++failures;
        std::printf ("    FAILED %s:%d  %s %s\n", file, line, expression, detail.c_str());
    }
} // namespace

#define TEST(name) static void name(); static Registrar name##_registrar (#name, name); static void name()
#define CHECK(expr) check ((expr), #expr, __FILE__, __LINE__)
#define CHECK_NEAR(a, b, tolerance) \
    check (std::abs ((a) - (b)) <= (tolerance), #a " ~= " #b, __FILE__, __LINE__, \
           "(" + std::to_string (a) + " vs " + std::to_string (b) + ")")
#define CHECK_EQ(a, b) \
    check ((a) == (b), #a " == " #b, __FILE__, __LINE__, "(" + std::to_string (a) + " vs " + std::to_string (b) + ")")

//==============================================================================
namespace
{
    constexpr double testRate = 48000.0;
    constexpr double pi = 3.14159265358979323846;
    constexpr int samplesPerStep120 = 6000; // a 16th at 120 BPM, 48 kHz

    /** Renders one kit voice on its own. */
    std::vector<float> renderVoice (const DrumRecipe& recipe, float pitch = 0.0f, double seconds = 2.0)
    {
        DrumVoice voice;
        voice.start (recipe, pitch, 1.0f, 0, testRate, 1234u, 1);
        std::vector<float> out (static_cast<size_t> (seconds * testRate), 0.0f);
        voice.render (out.data(), static_cast<int> (out.size()));
        return out;
    }

    /** Frequency estimate from upward zero crossings in [from, to). */
    double estimateFrequency (const std::vector<float>& signal, size_t from, size_t to)
    {
        int crossings = 0;
        size_t first = 0, last = 0;
        for (size_t i = from + 1; i < to; ++i)
            if (signal[i - 1] < 0.0f && signal[i] >= 0.0f)
            {
                if (crossings == 0) first = i;
                last = i;
                ++crossings;
            }
        if (crossings < 2)
            return 0.0;
        return (crossings - 1) * testRate / static_cast<double> (last - first);
    }

    double rms (const std::vector<float>& signal, size_t from, size_t to)
    {
        double sum = 0.0;
        for (size_t i = from; i < to && i < signal.size(); ++i)
            sum += signal[i] * signal[i];
        return std::sqrt (sum / static_cast<double> (std::max<size_t> (1, to - from)));
    }

    float peakOf (const std::vector<float>& signal)
    {
        float peak = 0.0f;
        for (float s : signal) peak = std::max (peak, std::abs (s));
        return peak;
    }

    /** Index of the last sample louder than threshold. */
    size_t lastAudibleSample (const std::vector<float>& signal, float threshold = 1.0e-3f)
    {
        for (size_t i = signal.size(); i-- > 0;)
            if (std::abs (signal[i]) > threshold)
                return i;
        return 0;
    }

    double magnitudeDb (const BiquadCoeffs& c, double frequency, double rate)
    {
        const std::complex<double> z = std::polar (1.0, -2.0 * pi * frequency / rate);
        const auto h = (c.b0 + c.b1 * z + c.b2 * z * z) / (1.0 + c.a1 * z + c.a2 * z * z);
        return 20.0 * std::log10 (std::abs (h));
    }

    EngineCommand command (EngineCommand::Type type, int sound = 0, char key = 0)
    {
        EngineCommand c;
        c.type = type;
        c.sound = sound;
        c.padKey = key;
        return c;
    }

    EngineCommand trigger (const char* soundId, char key = '1')
    {
        return command (EngineCommand::Type::Trigger, DrumKit::findSound (soundId), key);
    }

    /** Drives an engine block by block, delivering commands at absolute sample times. */
    struct Harness
    {
        LoopPadEngine engine;
        EngineParams params;
        TransportInfo transport;
        std::vector<float> left, right;
        std::vector<std::pair<int64_t, EngineEvent>> events; // absolute block start, event
        int64_t now = 0;
        int blockSize = 256;

        Harness()
        {
            params.metronome = false;
            engine.setParams (params);
            engine.prepare (testRate, 512);
        }

        void setParams (const EngineParams& p) { params = p; engine.setParams (p); }

        /** Runs until absolute time `until`, applying commands at their times. */
        void runTo (int64_t until, std::vector<std::pair<int64_t, EngineCommand>> commands = {})
        {
            while (now < until)
            {
                const int n = static_cast<int> (std::min<int64_t> (blockSize, until - now));
                std::vector<EngineCommand> block;
                for (auto& [time, c] : commands)
                    if (time >= now && time < now + n)
                    {
                        auto copy = c;
                        copy.sampleOffset = static_cast<int> (time - now);
                        block.push_back (copy);
                    }

                std::vector<float> l (static_cast<size_t> (n)), r (static_cast<size_t> (n));
                engine.process (l.data(), r.data(), n, transport, block.data(), static_cast<int> (block.size()));
                left.insert (left.end(), l.begin(), l.end());
                right.insert (right.end(), r.begin(), r.end());
                for (int e = 0; e < engine.getNumEvents(); ++e)
                    events.push_back ({ now, engine.getEvents()[e] });
                now += n;
            }
        }

        void at (int64_t time, EngineCommand c) { runTo (time + 1, { { time, c } }); }

        int countEvents (EngineEvent::Type type) const
        {
            int n = 0;
            for (auto& [time, e] : events) n += e.type == type ? 1 : 0;
            return n;
        }
    };

    /** Absolute sample where step `s` of the first recording pass falls, after REC at time 0. */
    int64_t recordStepTime (double s) { return static_cast<int64_t> ((s + LoopPadEngine::countInSteps) * samplesPerStep120); }
} // namespace

//==============================================================================
// Filters

TEST (filtersMatchWebAudioResponses)
{
    const auto lp = designLowPass (1000.0, 1.0, testRate);
    const auto hp = designHighPass (1000.0, 1.0, testRate);
    const auto bp = designBandPass (1000.0, 2.0, testRate);

    CHECK_NEAR (magnitudeDb (lp, 20.0, testRate), 0.0, 0.1);
    CHECK_NEAR (magnitudeDb (lp, 1000.0, testRate), 1.0, 0.05); // Web Audio: Q in dB is the gain at cutoff
    CHECK (magnitudeDb (lp, 8000.0, testRate) < -30.0);
    CHECK_NEAR (magnitudeDb (hp, 15000.0, testRate), 0.0, 0.1);
    CHECK (magnitudeDb (hp, 125.0, testRate) < -30.0);
    CHECK_NEAR (magnitudeDb (bp, 1000.0, testRate), 0.0, 0.01); // band-pass: 0 dB at the centre
    CHECK (magnitudeDb (bp, 250.0, testRate) < -10.0);
    CHECK (magnitudeDb (bp, 4000.0, testRate) < -10.0);
}

//==============================================================================
// Kit

TEST (kitMatchesTheUiList)
{
    CHECK_EQ (DrumKit::numSounds(), 25);
    CHECK_EQ (DrumKit::findSound ("punch_kick"), 0);
    CHECK_EQ (DrumKit::findSound ("noise_drop"), 24);
    CHECK_EQ (DrumKit::findSound ("no_such_sound"), -1);
}

TEST (everyKitSoundIsAudibleFiniteAndEndsOnTime)
{
    for (int i = 0; i < DrumKit::numSounds(); ++i)
    {
        const auto& recipe = DrumKit::sound (i);
        const auto out = renderVoice (recipe);

        float longestStop = 0.0f;
        for (int l = 0; l < recipe.numLayers; ++l)
            longestStop = std::max (longestStop, recipe.layers[static_cast<size_t> (l)].offset + recipe.layers[static_cast<size_t> (l)].stopTime);

        bool finite = true;
        for (float s : out) finite = finite && std::isfinite (s);

        const auto peak = peakOf (out);
        const auto end = lastAudibleSample (out, 1.0e-6f);
        if (! (finite && peak > 0.05f && peak < 2.0f && end <= static_cast<size_t> (longestStop * testRate) + 1))
            std::printf ("    %s: peak %.3f, ends at %.3f s (stop %.3f s)\n", recipe.id, peak, end / testRate, longestStop);

        CHECK (finite);
        CHECK (peak > 0.05f);  // audible
        CHECK (peak < 2.0f);   // no runaway filters
        CHECK (end <= static_cast<size_t> (longestStop * testRate) + 1);
    }
}

TEST (pitchScalesTheRecipeFrequencies)
{
    // Agogo: a constant 1150 Hz triangle. +12 semitones doubles it; -12 halves it.
    const auto& agogo = DrumKit::sound (DrumKit::findSound ("agogo"));
    const size_t from = 100, to = static_cast<size_t> (0.15 * testRate);
    CHECK_NEAR (estimateFrequency (renderVoice (agogo, 0.0f), from, to), 1150.0, 5.0);
    CHECK_NEAR (estimateFrequency (renderVoice (agogo, 12.0f), from, to), 2300.0, 10.0);
    CHECK_NEAR (estimateFrequency (renderVoice (agogo, -12.0f), from, to), 575.0, 5.0);
}

TEST (pitchSweepsFollowTheRecipe)
{
    // Sub 808: 120 Hz falling to 42 Hz over 120 ms, then constant.
    const auto out = renderVoice (DrumKit::sound (DrumKit::findSound ("sub_808")));
    const double tail = estimateFrequency (out, static_cast<size_t> (0.2 * testRate), static_cast<size_t> (0.6 * testRate));
    CHECK_NEAR (tail, 42.0, 1.5);
}

TEST (hatDecaysShortenWithPitch)
{
    // Open hat: decay 0.38 s / max(0.5, pitch). Up an octave it decays twice as fast.
    const auto& hat = DrumKit::sound (DrumKit::findSound ("open_hat"));
    const auto normal = renderVoice (hat, 0.0f);
    const auto high = renderVoice (hat, 12.0f);
    const size_t at = static_cast<size_t> (0.15 * testRate);
    CHECK (rms (high, at, at + 2400) < 0.5 * rms (normal, at, at + 2400));
}

TEST (padVolumeScalesTheVoice)
{
    const auto& kick = DrumKit::sound (DrumKit::findSound ("punch_kick"));
    DrumVoice a, b;
    a.start (kick, 0.0f, 1.0f, 0, testRate, 7u, 1);
    b.start (kick, 0.0f, 0.5f, 0, testRate, 7u, 2);
    std::vector<float> outA (4800), outB (4800);
    a.render (outA.data(), 4800);
    b.render (outB.data(), 4800);
    CHECK_NEAR (peakOf (outB) / peakOf (outA), 0.5f, 1.0e-4f);
}

//==============================================================================
// Engine: output

TEST (silentUntilSomethingPlays)
{
    Harness h;
    h.runTo (48000);
    CHECK (peakOf (h.left) == 0.0f);
}

TEST (triggersStartAtTheirSampleOffset)
{
    Harness h;
    h.runTo (1000, { { 700, trigger ("punch_kick") } });
    size_t first = 0;
    while (first < h.left.size() && h.left[first] == 0.0f) ++first;
    // Sine starts at 0, so the first non-zero sample is one after the trigger.
    CHECK (first >= 700 && first <= 701);
}

TEST (masterVolumeAndMute)
{
    auto level = [] (float volume, bool mute)
    {
        Harness h;
        auto p = h.params;
        p.masterVolume = volume;
        p.mute = mute;
        h.setParams (p);
        h.engine.prepare (testRate, 512); // start the smoother at the target
        h.runTo (4800, { { 0, trigger ("sub_808") } });
        return rms (h.left, 0, 4800);
    };

    const double full = level (1.0f, false);
    CHECK (full > 0.0);
    CHECK_NEAR (level (0.5f, false) / full, 0.5, 0.02);
    CHECK (level (1.0f, true) < 1.0e-6);
}

TEST (outputStaysWithinFullScale)
{
    // Ten kicks at 130% on top of each other would clip without the soft clipper.
    Harness h;
    auto p = h.params;
    p.masterVolume = 1.0f;
    h.setParams (p);
    std::vector<std::pair<int64_t, EngineCommand>> hits;
    for (int i = 0; i < 10; ++i)
    {
        auto c = trigger (i % 2 ? "sub_808" : "punch_kick");
        c.volume = 1.3f;
        hits.push_back ({ i, c });
    }
    h.runTo (24000, hits);
    CHECK (peakOf (h.left) <= 1.0f);
    CHECK (peakOf (h.left) > 0.8f);
    CHECK (h.left == h.right);
}

TEST (voicesAreStolenWhenThePoolIsFull)
{
    Harness h;
    std::vector<std::pair<int64_t, EngineCommand>> hits;
    for (int i = 0; i < 100; ++i)
        hits.push_back ({ i * 10, trigger ("crash") });
    h.runTo (48000, hits);

    bool finite = true;
    for (float s : h.left) finite = finite && std::isfinite (s);
    CHECK (finite);
    CHECK (peakOf (h.left) > 0.1f);
}

TEST (previewDoesNotRecord)
{
    Harness h;
    h.at (0, command (EngineCommand::Type::Record));
    h.runTo (recordStepTime (2), { { recordStepTime (2) - 1, command (EngineCommand::Type::Preview, DrumKit::findSound ("clap")) } });
    CHECK_EQ (h.engine.getLoop().count, 0);
}

//==============================================================================
// Engine: transport

TEST (recordCountsInThreeBeatsThenRecordsFourBars)
{
    Harness h;
    CHECK (h.engine.getMode() == TransportMode::Idle);
    h.at (0, command (EngineCommand::Type::Record));
    CHECK (h.engine.getMode() == TransportMode::CountIn);

    h.runTo (recordStepTime (0) - 1);
    CHECK (h.engine.getMode() == TransportMode::CountIn);
    h.runTo (recordStepTime (0) + 1);
    CHECK (h.engine.getMode() == TransportMode::Recording);

    h.runTo (recordStepTime (64) - 1);
    CHECK (h.engine.getMode() == TransportMode::Recording);
    h.runTo (recordStepTime (64) + 1);
    CHECK (h.engine.getMode() == TransportMode::Playing); // loops straight into playback

    CHECK_EQ (h.engine.getTelemetry().recordBeat, 16u);   // one per quarter note of the take
}

TEST (metronomeClicksOnBeatsWithCountIn)
{
    Harness h;
    auto p = h.params;
    p.metronome = true;
    h.setParams (p);
    h.at (0, command (EngineCommand::Type::Record));
    h.runTo (recordStepTime (8));

    // Clicks at the three count-in beats and at steps 0 and 4.
    for (double step : { -12.0, -8.0, -4.0, 0.0, 4.0 })
    {
        const auto t = static_cast<size_t> (recordStepTime (step));
        CHECK (rms (h.left, t, t + 1000) > 0.01);
        CHECK (rms (h.left, t + 3000, t + 5000) < 1.0e-4); // silent between clicks
    }
}

TEST (metronomeOffIsSilent)
{
    Harness h;
    h.at (0, command (EngineCommand::Type::Record));
    h.runTo (recordStepTime (16));
    CHECK (peakOf (h.left) == 0.0f);
}

TEST (hitsSnapToTheNearestSixteenth)
{
    Harness h;
    h.at (0, command (EngineCommand::Type::Record));
    h.runTo (recordStepTime (64) - 1, {
        { recordStepTime (-0.6), trigger ("rimshot", 'A') },    // too early: dropped
        { recordStepTime (-0.4), trigger ("clap", 'B') },       // last half step of the count-in: step 0
        { recordStepTime (10.4), trigger ("closed_hat", 'C') }, // -> 10
        { recordStepTime (10.6), trigger ("open_hat", 'D') },   // -> 11
        { recordStepTime (63.7), trigger ("crash", 'E') },      // wraps -> 0
    });

    const auto& loop = h.engine.getLoop();
    CHECK_EQ (loop.count, 4);
    auto stepOf = [&] (char key)
    {
        for (int i = 0; i < loop.count; ++i)
            if (loop.notes[static_cast<size_t> (i)].padKey == key)
                return loop.notes[static_cast<size_t> (i)].step;
        return -1;
    };
    CHECK_EQ (stepOf ('A'), -1);
    CHECK_EQ (stepOf ('B'), 0);
    CHECK_EQ (stepOf ('C'), 10);
    CHECK_EQ (stepOf ('D'), 11);
    CHECK_EQ (stepOf ('E'), 0);
}

TEST (sameSoundOnTheSameStepIsReplaced)
{
    Harness h;
    h.at (0, command (EngineCommand::Type::Record));
    auto soft = trigger ("clap");
    soft.volume = 0.3f;
    h.runTo (recordStepTime (8), { { recordStepTime (3.9), trigger ("clap") }, { recordStepTime (4.1), soft } });
    CHECK_EQ (h.engine.getLoop().count, 1);
    CHECK_NEAR (h.engine.getLoop().notes[0].volume, 0.3f, 1.0e-6f); // the later hit wins
}

TEST (recordedHitsPlayBackEveryLoopAtTheirStep)
{
    Harness h;
    h.at (0, command (EngineCommand::Type::Record));
    h.runTo (recordStepTime (64) + 64 * samplesPerStep120 * 2, { { recordStepTime (4), trigger ("cowbell", 'R') } });

    std::vector<int64_t> hitBlocks;
    for (auto& [time, e] : h.events)
        if (e.type == EngineEvent::Type::LoopHit)
        {
            CHECK (e.note.padKey == 'R');
            hitBlocks.push_back (time);
        }

    CHECK_EQ (hitBlocks.size(), size_t (2));
    if (hitBlocks.size() == 2)
    {
        // Within the block that contains step 4 of the next pass, and one loop apart.
        const int64_t expected = recordStepTime (64 + 4);
        CHECK (hitBlocks[0] <= expected && expected < hitBlocks[0] + h.blockSize);
        CHECK_EQ (hitBlocks[1] - hitBlocks[0], int64_t (64 * samplesPerStep120));
    }

    // The voice starts exactly on the step: silence before it in the second pass.
    const auto t = static_cast<size_t> (recordStepTime (64 + 4));
    CHECK (rms (h.left, t - 2000, t - 1) < 1.0e-6);
    CHECK (rms (h.left, t, t + 2000) > 0.01);
}

TEST (aNewTakeReplacesTheLoopOnlyOnceRecordingStarts)
{
    Harness h;
    h.at (0, command (EngineCommand::Type::Record));
    h.runTo (recordStepTime (64) + 10, { { recordStepTime (0), trigger ("clap") } });
    CHECK_EQ (h.engine.getLoop().count, 1);

    // REC again (from playback) -> count-in; stopping during the count-in keeps the old loop.
    const auto t0 = h.now;
    h.at (t0, command (EngineCommand::Type::Record));
    CHECK (h.engine.getMode() == TransportMode::CountIn);
    h.at (t0 + 1000, command (EngineCommand::Type::Record));
    CHECK (h.engine.getMode() == TransportMode::Idle);
    CHECK_EQ (h.engine.getLoop().count, 1);

    // A full take with no hits clears it.
    const auto t1 = h.now;
    h.at (t1, command (EngineCommand::Type::Record));
    h.runTo (t1 + recordStepTime (1));
    CHECK_EQ (h.engine.getLoop().count, 0);
    CHECK_EQ (h.countEvents (EngineEvent::Type::LoopCleared), 2);
}

TEST (playTogglesAndAlwaysStartsFromStepZero)
{
    Harness h;
    h.at (0, command (EngineCommand::Type::TogglePlay));
    CHECK (h.engine.getMode() == TransportMode::Playing);
    h.runTo (10 * samplesPerStep120 + 10);
    CHECK_EQ (h.engine.getTelemetry().step, 10);
    h.at (h.now, command (EngineCommand::Type::TogglePlay));
    CHECK (h.engine.getMode() == TransportMode::Idle);
    h.at (h.now, command (EngineCommand::Type::TogglePlay));
    h.runTo (h.now + 100);
    CHECK_EQ (h.engine.getTelemetry().step, 0);
}

TEST (playingDoesNotRecord)
{
    Harness h;
    h.at (0, command (EngineCommand::Type::TogglePlay));
    h.runTo (20000, { { 5000, trigger ("clap") } });
    CHECK_EQ (h.engine.getLoop().count, 0);
}

TEST (tempoChangesMidLoopKeepThePosition)
{
    Harness h;
    h.at (0, command (EngineCommand::Type::TogglePlay));
    h.runTo (8 * samplesPerStep120);
    CHECK_NEAR (h.engine.getPosition(), 8.0, 1.0e-6);

    auto p = h.params;
    p.bpm = 60.0f; // half speed: a step now takes 12000 samples
    h.setParams (p);
    h.runTo (h.now + 4 * 12000);
    CHECK_NEAR (h.engine.getPosition(), 12.0, 1.0e-6);
}

TEST (hostTempoOverridesTheBpmParameterWhileTheHostPlays)
{
    Harness h;
    h.transport.isPlaying = true;
    h.transport.bpm = 240.0;
    h.at (0, command (EngineCommand::Type::TogglePlay));
    h.runTo (8 * 3000);
    CHECK_NEAR (h.engine.getPosition(), 8.0, 1.0e-6);
    CHECK (h.engine.getTelemetry().hostSynced);
    CHECK_NEAR (h.engine.getTelemetry().bpm, 240.0, 1.0e-9);
}

TEST (restoredLoopPlaysBack)
{
    Harness h;
    Loop loop;
    loop.add ({ 0, DrumKit::findSound ("punch_kick"), 0.0f, 1.0f, 'Z' });
    h.engine.setLoop (loop);
    h.at (0, command (EngineCommand::Type::TogglePlay));
    h.runTo (1000);
    CHECK_EQ (h.countEvents (EngineEvent::Type::LoopHit), 1);
    CHECK (rms (h.left, 0, 1000) > 0.01);
}

//==============================================================================
// Step clock (kept as a building block)

TEST (freeRunningClockTicksImmediatelyThenEvenly)
{
    StepClock clock;
    TransportInfo transport;
    std::vector<int64_t> tickTimes;

    for (int block = 0; block < 100; ++block)
    {
        clock.beginBlock (transport, 120.0, 0.125, testRate, true);
        if (block == 2)
            clock.start (100);

        for (int offset; (offset = clock.nextTickOffset (512)) >= 0;)
        {
            clock.consumeTick();
            tickTimes.push_back (block * 512 + offset);
        }
        clock.endBlock (512);
    }

    CHECK (tickTimes.size() > 10);
    CHECK (tickTimes[0] == 2 * 512 + 100);
    for (size_t i = 1; i < tickTimes.size(); ++i)
        CHECK_NEAR (static_cast<double> (tickTimes[i] - tickTimes[i - 1]), 3000.0, 1.0); // 1/32 note at 120 BPM
}

TEST (hostSyncedClockFollowsSongPosition)
{
    StepClock clock;
    TransportInfo transport;
    transport.isPlaying = true;
    transport.hasPpqPosition = true;
    transport.bpm = 120.0;
    transport.ppqPosition = 3.9; // just before beat 4

    std::vector<double> tickBeats;
    clock.beginBlock (transport, 120.0, 0.25, testRate, true);
    clock.start (0);

    for (int block = 0; block < 60; ++block)
    {
        if (block > 0)
            clock.beginBlock (transport, 120.0, 0.25, testRate, true);

        for (int offset; (offset = clock.nextTickOffset (512)) >= 0;)
        {
            const auto index = clock.consumeTick();
            tickBeats.push_back (static_cast<double> (index) * 0.25);
            (void) offset;
        }
        clock.endBlock (512);
        transport.ppqPosition += 512 / testRate * 2.0;
    }

    CHECK (! tickBeats.empty());
    CHECK_NEAR (tickBeats.front(), 4.0, 1.0e-9); // waits for the grid, doesn't fire at 3.9
}

//==============================================================================
// Performance

TEST (thirtyTwoVoicesRunFasterThanRealTime)
{
    Harness h;
    std::vector<std::pair<int64_t, EngineCommand>> hits;
    for (int i = 0; i < 4 * 32; ++i)
        hits.push_back ({ i * 1500, trigger (DrumKit::sound (i % DrumKit::numSounds()).id) });

    const auto begin = std::chrono::steady_clock::now();
    h.runTo (static_cast<int64_t> (4.0 * testRate), hits);
    const double elapsed = std::chrono::duration<double> (std::chrono::steady_clock::now() - begin).count();

    std::printf ("    4 s of dense hits: %.1f%% of real time\n", elapsed / 4.0 * 100.0);
    CHECK (elapsed < 4.0); // generous: must at least keep up, even in debug builds
}

//==============================================================================
int main()
{
    for (const auto& test : registry())
    {
        const int before = failures;
        test.body();
        std::printf ("%s %s\n", failures == before ? "[ ok ]" : "[FAIL]", test.name);
    }

    std::printf ("\n%zu tests, %d failed checks\n", registry().size(), failures);
    return failures == 0 ? 0 : 1;
}
