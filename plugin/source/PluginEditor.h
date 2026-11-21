#pragma once

#include "PluginProcessor.h"
#include "WebUiBridge.h"

#include <juce_gui_extra/juce_gui_extra.h>

/** The plugin window: a web view showing the React UI, kept to a fixed aspect ratio. */
class PluginEditor : public juce::AudioProcessorEditor,
                             private juce::ChangeListener
{
public:
    explicit PluginEditor (PluginProcessor&);
    ~PluginEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

    // Must match DESIGN_WIDTH / DESIGN_HEIGHT in ui/src/App.tsx.
    static constexpr int designWidth = 1024;
    static constexpr int designHeight = 600;

private:
    /** Keeps the web view on our page: dropped files or links can't navigate it away. */
    class SinglePageBrowser : public juce::WebBrowserComponent
    {
    public:
        using WebBrowserComponent::WebBrowserComponent;
        bool pageAboutToLoad (const juce::String& newURL) override;
    };

    void changeListenerCallback (juce::ChangeBroadcaster*) override;
    juce::WebBrowserComponent::Options createBrowserOptions();

    PluginProcessor& processor;
    WebUiBridge bridge;
    SinglePageBrowser browser;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (PluginEditor)
};
