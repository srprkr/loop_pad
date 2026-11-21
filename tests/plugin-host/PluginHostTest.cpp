// End-to-end check of the built VST3, run by ctest on every platform (including CI on Windows/macOS).
//
// Loads the plugin the way a DAW does, sends MIDI notes to the pads, and checks that audio comes
// out, that MIDI follows the saved kit, and that the kit and recorded loop survive a save/reload.
// (The loop transport is driven from the UI, which a host can't do; tests/EngineTests.cpp covers it.)
//
// Usage: plugin_host_test "<path to the .vst3>"

#include <juce_audio_processors/juce_audio_processors.h>

using namespace juce;

namespace
{
    constexpr double sampleRate = 48000.0;
    constexpr int blockSize = 512;
    int failures = 0;

    void check (bool condition, const String& what)
    {
        std::printf ("%s %s\n", condition ? "[ ok ]" : "[FAIL]", what.toRawUTF8());
        if (! condition)
            ++failures;
    }

    //==========================================================================
    // JUCE's VST3 host wraps the plugin's own state as base64 in <VST3PluginState><IComponent>.

    ValueTree readPluginState (AudioPluginInstance& plugin)
    {
        MemoryBlock state;
        plugin.getStateInformation (state);
        auto xml = AudioProcessor::getXmlFromBinary (state.getData(), (int) state.getSize());
        auto* component = xml != nullptr ? xml->getChildByName ("IComponent") : nullptr;
        MemoryBlock inner;
        if (component == nullptr || ! inner.fromBase64Encoding (component->getAllSubText()))
            return {};

        auto pluginXml = AudioProcessor::getXmlFromBinary (inner.getData(), (int) inner.getSize());
        return pluginXml != nullptr ? ValueTree::fromXml (*pluginXml) : ValueTree();
    }

    void writePluginState (AudioPluginInstance& plugin, const ValueTree& tree)
    {
        MemoryBlock state;
        plugin.getStateInformation (state);
        auto xml = AudioProcessor::getXmlFromBinary (state.getData(), (int) state.getSize());
        auto* component = xml != nullptr ? xml->getChildByName ("IComponent") : nullptr;
        if (component == nullptr)
            return;

        MemoryBlock newInner;
        AudioProcessor::copyXmlToBinary (*tree.createXml(), newInner);
        component->deleteAllTextElements();
        component->addTextElement (newInner.toBase64Encoding());

        MemoryBlock newState;
        AudioProcessor::copyXmlToBinary (*xml, newState);
        plugin.setStateInformation (newState.getData(), (int) newState.getSize());
    }

    /** A kit whose 4x4 set has `sound` on pad 0 and nothing usable elsewhere. */
    String kitWithFirstPad (const String& sound)
    {
        String pads;
        for (int i = 0; i < 16; ++i)
            pads << (i > 0 ? "," : "") << "{\"soundType\":\"" << (i == 0 ? sound : String ("none")) << "\",\"pitchSemitones\":0,\"volume\":1,\"key\":\"" << String (i) << "\"}";
        return "{\"gridSize\":\"4x4\",\"pads\":{\"4x4\":[" + pads + "]}}";
    }

    //==========================================================================
    /** RMS of the left channel over `blocks` blocks; `midi` is delivered in the first block. */
    double render (AudioPluginInstance& plugin, const MidiBuffer& midi, int blocks)
    {
        AudioBuffer<float> buffer (jmax (2, plugin.getTotalNumOutputChannels()), blockSize);
        double sum = 0.0;
        int64 count = 0;

        for (int b = 0; b < blocks; ++b)
        {
            buffer.clear();
            MidiBuffer events;
            if (b == 0)
                events = midi;

            plugin.processBlock (buffer, events);

            for (int i = 0; i < blockSize; ++i)
            {
                const auto s = buffer.getSample (0, i);
                sum += (double) s * s;
                ++count;
            }
        }
        return std::sqrt (sum / (double) jmax<int64> (1, count));
    }

    MidiBuffer single (const MidiMessage& message, int offset = 0)
    {
        MidiBuffer buffer;
        buffer.addEvent (message, offset);
        return buffer;
    }
} // namespace

int main (int argc, char** argv)
{
    if (argc < 2)
    {
        std::puts ("usage: plugin_host_test <path to .vst3>");
        return 2;
    }

    ScopedJuceInitialiser_GUI juce; // this thread becomes the message thread, as in a DAW

    AudioPluginFormatManager formats;
    formats.addFormat (new VST3PluginFormat());

    OwnedArray<PluginDescription> types;
    formats.getFormat (0)->findAllTypesForFile (types, String::fromUTF8 (argv[1]));
    check (! types.isEmpty(), "plugin found in " + String::fromUTF8 (argv[1]));
    if (types.isEmpty())
        return 1;

    const auto& description = *types.getFirst();
    check (description.isInstrument, "registered as an instrument (" + description.category + ")");

    String error;
    auto plugin = formats.createPluginInstance (description, sampleRate, blockSize, error);
    check (plugin != nullptr, "plugin instance created " + error);
    if (plugin == nullptr)
        return 1;

    check (plugin->acceptsMidi(), "accepts MIDI");
    check (plugin->getTotalNumOutputChannels() == 2, "stereo output");

    plugin->setPlayConfigDetails (0, 2, sampleRate, blockSize);
    plugin->prepareToPlay (sampleRate, blockSize);

    check (render (*plugin, {}, 10) < 1.0e-6, "silent with no notes");

    // Default 4x4 kit, before any UI has opened: note 36 = pad 1 (Closed Hat), 48 = pad Z (Punch Kick).
    for (int channel : { 1, 10, 16 })
    {
        const auto level = render (*plugin, single (MidiMessage::noteOn (channel, 48, (uint8) 100)), 20);
        check (level > 0.01, "MIDI note 48 on channel " + String (channel) + " plays a pad (rms " + String (level, 4) + ")");
        render (*plugin, {}, 40);
    }

    const auto hat = render (*plugin, single (MidiMessage::noteOn (1, 36, (uint8) 127), blockSize / 2), 10);
    check (hat > 0.005, "note 36 arriving mid-block plays pad 1 (rms " + String (hat, 4) + ")");
    render (*plugin, {}, 40);

    check (render (*plugin, single (MidiMessage::noteOn (1, 35, (uint8) 127)), 20) < 1.0e-6, "notes below the pads are ignored");
    check (render (*plugin, single (MidiMessage::noteOn (1, 52, (uint8) 127)), 20) < 1.0e-6, "notes above the 4x4 pads are ignored");

    const auto loud = render (*plugin, single (MidiMessage::noteOn (1, 49, (uint8) 127)), 10);
    render (*plugin, {}, 60);
    const auto soft = render (*plugin, single (MidiMessage::noteOn (1, 49, (uint8) 32)), 10);
    render (*plugin, {}, 60);
    check (soft < loud * 0.5, "velocity scales the pad volume");
    render (*plugin, {}, 40); // note 49 is Sub 808, which rings for 0.8 s

    check (render (*plugin, {}, 10) < 1.0e-6, "silent again once the sounds have ended");

    // Session state: a saved kit drives MIDI, and kit + loop come back unchanged.
    {
        auto tree = readPluginState (*plugin);
        check (tree.isValid(), "plugin state readable");

        auto extra = tree.getOrCreateChildWithName ("ExtraState", nullptr);
        extra.setProperty ("kit", kitWithFirstPad ("sub_808"), nullptr);
        extra.setProperty ("loop", "[{\"step\":4,\"sound\":\"clap\",\"pitch\":2,\"volume\":0.5,\"key\":\"Q\"},"
                                   "{\"step\":99,\"sound\":\"clap\",\"pitch\":0,\"volume\":1,\"key\":\"Q\"}]", nullptr);
        writePluginState (*plugin, tree); // restored synchronously: this thread is the message thread

        // Sub 808 (0.8 s) is far longer than the closed hat (0.08 s).
        render (*plugin, single (MidiMessage::noteOn (1, 36, (uint8) 127)), 10);
        check (render (*plugin, {}, 20) > 0.01, "MIDI follows the kit from the saved state");
        render (*plugin, {}, 80);
        check (render (*plugin, single (MidiMessage::noteOn (1, 37, (uint8) 127)), 20) < 1.0e-6, "pads with an unknown sound stay silent");

        const auto reread = readPluginState (*plugin).getChildWithName ("ExtraState");
        const auto loop = JSON::parse (reread["loop"].toString());
        check (loop.isArray() && loop.size() == 1, "loop restored (invalid steps dropped)");
        check (loop[0]["sound"] == "clap" && (int) loop[0]["step"] == 4 && (double) loop[0]["pitch"] == 2.0
                   && std::abs ((double) loop[0]["volume"] - 0.5) < 1.0e-6 && loop[0]["key"] == "Q",
               "loop hit round-trips");
        check (JSON::parse (reread["kit"].toString())["pads"]["4x4"][0]["soundType"] == "sub_808", "kit round-trips");
    }

    plugin->releaseResources();
    plugin.reset();

    std::printf ("\n%s\n", failures == 0 ? "PLUGIN MIDI TEST PASSED" : "PLUGIN MIDI TEST FAILED");
    return failures == 0 ? 0 : 1;
}
