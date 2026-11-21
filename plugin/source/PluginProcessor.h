#pragma once

#include "Parameters.h"

#include <juce_audio_processors/juce_audio_processors.h>
#include <core/LoopPadEngine.h>

#include <mutex>

/**
    The audio processor: owns the parameters, the kit, the loop and the engine.

    Threading
      - The UI (message thread) sends pad hits and transport commands through a lock-free FIFO.
      - The kit's current pad set (for MIDI input) and a restored loop are handed to the audio
        thread through a small mutex that the audio thread only ever try-locks.
      - The engine reports loop changes and playback hits through another lock-free FIFO. The
        message thread keeps its own copy of the loop from those, for saving the session.
*/
class PluginProcessor : public juce::AudioProcessor,
                        public juce::ChangeBroadcaster,
                        private juce::Timer
{
public:
    /** MIDI note of the first pad; pads follow row by row (36 = C1, the usual drum-pad layout). */
    static constexpr int firstPadNote = 36;
    static constexpr int maxPads = 25;

    PluginProcessor();
    ~PluginProcessor() override;

    //==============================================================================
    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override {}
    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;
    using AudioProcessor::processBlock;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return JucePlugin_Name; }
    bool acceptsMidi() const override { return true; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 1.5; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return {}; }
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    //==============================================================================
    // Message-thread API used by the editor.

    juce::AudioProcessorValueTreeState& getState() noexcept { return state; }

    /** The UI's kit (three pad sets + grid size), as sent by setKit. Null until the UI sends one. */
    const juce::var& getKit() const noexcept { return kit; }
    void setKit (const juce::var& newKit);

    juce::var getUiState() const { return uiState; }
    void setUiState (const juce::var& newState) { uiState = newState; }

    /** Pad hits and transport commands from the UI. Safe from any single thread. */
    void pushCommand (const core::EngineCommand& command);

    /** Loop-playback hits since the last call, for the UI's pad flashes. */
    std::vector<core::LoopNote> takeLoopHits();

    /** Latest engine snapshot for the UI. */
    core::EngineTelemetry getTelemetry() const;

    /** The message thread's copy of the loop (kept in step with the engine). */
    const core::Loop& getLoop() const noexcept { return *loopCopy; }

    // As a ChangeBroadcaster, the processor notifies the editor when the whole state was
    // replaced (session load), so the UI can refetch everything.

private:
    struct PadSlot
    {
        int sound = -1;
        float pitch = 0.0f;
        float volume = 1.0f;
        char key = 0;
    };
    using PadTable = std::array<PadSlot, maxPads>;

    void timerCallback() override;
    void drainEngineEvents();
    void publishPadTable();
    void publishLoop();

    juce::AudioProcessorValueTreeState state;
    ParameterSnapshot parameterSnapshot;
    core::LoopPadEngine engine;

    // Message-thread state.
    juce::var kit;
    juce::var uiState;
    std::unique_ptr<core::Loop> loopCopy = std::make_unique<core::Loop>();
    std::vector<core::LoopNote> pendingHits;

    // Hand-over to the audio thread (try-locked there).
    std::mutex handoverMutex;
    PadTable pendingPads {};
    bool padsPending = false;
    std::unique_ptr<core::Loop> pendingLoop = std::make_unique<core::Loop>();
    bool loopPending = false;
    PadTable audioPads {}; // audio thread only

    // UI -> audio thread.
    static constexpr int commandFifoSize = 512;
    juce::AbstractFifo commandFifo { commandFifoSize };
    std::array<core::EngineCommand, commandFifoSize> commandSlots {};
    std::vector<core::EngineCommand> blockCommands;

    // Audio thread -> message thread.
    static constexpr int eventFifoSize = 4096;
    juce::AbstractFifo eventFifo { eventFifoSize };
    std::array<core::EngineEvent, eventFifoSize> eventSlots {};

    mutable std::mutex telemetryMutex;
    core::EngineTelemetry telemetry;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (PluginProcessor)
};
