#pragma once

namespace core
{

/** A plain snapshot of every automatable setting, copied into the engine once per block. */
struct EngineParams
{
    float masterVolume = 0.85f; // 0..1
    bool mute = false;
    float bpm = 120.0f;         // 60..200; used unless the host transport is playing
    bool metronome = true;
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
