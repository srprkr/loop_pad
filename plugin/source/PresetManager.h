#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

/**
    User presets, stored as JSON files in Documents/<product name>/Presets.

    A preset holds every parameter. Samples are not stored: presets are "settings", and the
    sample that is loaded stays loaded. To store more (say, per-pad sample paths), add it to
    the JSON in save() and read it back in load().
*/
class PresetManager
{
public:
    struct Preset
    {
        juce::String id; // file name without extension
        juce::String name;
        bool favorite = false;
    };

    explicit PresetManager (juce::AudioProcessorValueTreeState& state);

    static juce::File getPresetFolder();

    juce::Array<Preset> list() const;

    /** Saves the current settings. Returns the new preset id, or an empty string on failure. */
    juce::String save (const juce::String& name);

    /** Applies a preset's parameters. Returns false if it couldn't be read. */
    bool load (const juce::String& id);

    bool setFavorite (const juce::String& id, bool favorite);
    bool remove (const juce::String& id);

    juce::String getCurrentPresetId() const { return currentId; }
    void setCurrentPresetId (const juce::String& id) { currentId = id; }

private:
    juce::File fileFor (const juce::String& id) const;

    juce::AudioProcessorValueTreeState& state;
    juce::String currentId;
};
