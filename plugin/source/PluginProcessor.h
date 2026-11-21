#pragma once

#include "Parameters.h"
#include "PresetManager.h"
#include "SampleLibrary.h"

#include <juce_audio_processors/juce_audio_processors.h>
#include <core/SamplerEngine.h>

#include <mutex>

/**
    The audio processor: owns the parameters, the sample and the engine.

    Threading
      - The UI (message thread) changes the sample through the methods below. It is handed to
        the audio thread through a small mutex the audio thread only ever try-locks, so the
        audio thread never waits.
      - Old samples are kept alive on the message thread until the audio thread has let go of
        them, so memory is never freed inside processBlock().
*/
class PluginProcessor : public juce::AudioProcessor,
                        public juce::ChangeBroadcaster,
                        private juce::Timer
{
public:
    /** Where a sample can be loaded. One slot for now; a multi-sample product adds more here. */
    enum class SampleSlot { Main };

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
    double getTailLengthSeconds() const override { return 5.0; }

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
    SampleLibrary& getSampleLibrary() noexcept { return sampleLibrary; }
    PresetManager& getPresets() noexcept { return presets; }

    /** Loads a file into a slot. `resetMarkers` puts the region markers back to their defaults. */
    bool loadSample (SampleSlot slot, const juce::File& file, bool resetMarkers, juce::String& error);
    void clearSample (SampleSlot slot);
    const LoadedSample& getSample (SampleSlot slot) const noexcept;

    juce::var getUiState() const { return uiState; }
    void setUiState (const juce::var& newState) { uiState = newState; }

    /** Notes played from the UI (computer keyboard, on-screen controls). Safe from any thread. */
    void pushUiNote (const core::NoteEvent& event);

    bool applyPreset (const juce::String& presetId);

    /** Latest engine snapshot for the UI (playheads, meter). */
    core::EngineTelemetry getTelemetry() const;

    // As a ChangeBroadcaster, the processor notifies the editor when the whole state was
    // replaced (session load or preset), so the UI can refetch everything.

private:
    void timerCallback() override;
    void publishSampleToAudioThread();
    void setParameterPlainValue (const char* paramId, float value);

    juce::AudioProcessorValueTreeState state;
    ParameterSnapshot parameterSnapshot;
    SampleLibrary sampleLibrary;
    PresetManager presets;

    core::SamplerEngine engine;

    // Message-thread copies of what the audio thread is (or will be) using.
    LoadedSample mainSample;
    juce::var uiState;
    std::vector<core::SamplePtr> retiredSamples;

    // Hand-over to the audio thread.
    std::mutex handoverMutex;
    core::SamplePtr pendingSample;
    bool samplePending = false;

    juce::AbstractFifo uiNoteFifo { 256 };
    std::array<core::NoteEvent, 256> uiNotes {};
    std::vector<core::NoteEvent> blockEvents;

    mutable std::mutex telemetryMutex;
    core::EngineTelemetry telemetry;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (PluginProcessor)
};
