#pragma once

namespace core
{

enum class PlaybackMode { OneShot, Loop };
enum class FilterSlope  { Db12, Db18, Db24 };

struct FilterParams
{
    bool enabled = false;
    float cutoffHz = 1000.0f;
    float resonance = 1.0f; // "emphasis", 0.1 .. 10
    FilterSlope slope = FilterSlope::Db12;
};

/** A plain snapshot of every automatable setting, copied into the engine once per block. */
struct EngineParams
{
    float masterGain = 1.0f;

    // Sample region. Positions are fractions (0..1) of the loaded sample's length.
    PlaybackMode playbackMode = PlaybackMode::OneShot;
    float startPos = 0.0f;
    float endPos = 1.0f;
    float loopStartPos = 0.0f;
    float loopEndPos = 1.0f;
    float loopCrossfadeSec = 0.02f;

    // Amplitude envelope.
    float attackSec = 0.001f;
    float decaySec = 0.8f;
    float sustainLevel = 0.8f;
    float releaseSec = 0.5f;

    // Pitch & tempo.
    int rootNote = 60;
    bool preserveSpeed = true; // pitch changes per key, playback speed does not
    bool tempoSync = true;     // stretch playback by hostBpm / sampleBpm
    float sampleBpm = 120.0f;

    FilterParams highPass { false, 20.0f, 1.0f, FilterSlope::Db12 };
    FilterParams lowPass  { false, 20000.0f, 1.0f, FilterSlope::Db24 };
};

//==============================================================================
struct TransportInfo
{
    double bpm = 120.0;
    bool isPlaying = false;
    bool hasPpqPosition = false;
    double ppqPosition = 0.0; // quarter notes since the start of the song
};

} // namespace core
