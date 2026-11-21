#include "PluginEditor.h"

#include <BinaryData.h>

using namespace juce;

namespace
{
    const Colour background { 0xff09090b };

    /** Set UI_DEV_SERVER_URL (CMake) to load the UI from `npm run dev` with hot reload. */
    String devServerUrl()
    {
       #ifdef UI_DEV_SERVER_URL
        return UI_DEV_SERVER_URL;
       #else
        return {};
       #endif
    }

    std::optional<WebBrowserComponent::Resource> serveEmbeddedUi (const String& url)
    {
        // The UI is built into a single self-contained index.html (see ui/vite.config.ts).
        if (url != "/" && url != "/index.html")
            return std::nullopt;

        const auto* begin = reinterpret_cast<const std::byte*> (BinaryData::index_html);
        return WebBrowserComponent::Resource { { begin, begin + BinaryData::index_htmlSize }, "text/html" };
    }
} // namespace

//==============================================================================
bool PluginEditor::SinglePageBrowser::pageAboutToLoad (const String& newURL)
{
    const auto dev = devServerUrl();
    return newURL.startsWith (getResourceProviderRoot()) || (dev.isNotEmpty() && newURL.startsWith (dev));
}

PluginEditor::PluginEditor (PluginProcessor& p)
    : AudioProcessorEditor (p),
      processor (p),
      bridge (p),
      browser (createBrowserOptions())
{
    addAndMakeVisible (browser);
    bridge.attach (browser);
    processor.addChangeListener (this);

    const auto dev = devServerUrl();
    browser.goToURL (dev.isNotEmpty() ? dev : WebBrowserComponent::getResourceProviderRoot());

    setResizable (true, true);
    if (auto* sizeConstrainer = getConstrainer())
    {
        sizeConstrainer->setFixedAspectRatio ((double) designWidth / designHeight);
        sizeConstrainer->setSizeLimits (designWidth * 3 / 4, designHeight * 3 / 4, designWidth * 2, designHeight * 2);
    }
    setSize (designWidth, designHeight);
}

PluginEditor::~PluginEditor()
{
    processor.removeChangeListener (this);
}

WebBrowserComponent::Options PluginEditor::createBrowserOptions()
{
    auto options = WebBrowserComponent::Options {}
        .withBackend (WebBrowserComponent::Options::Backend::webview2)
        .withWinWebView2Options (WebBrowserComponent::Options::WinWebView2 {}
                                     .withBackgroundColour (background)
                                     .withStatusBarDisabled()
                                     // The host's folder is often read-only; give WebView2 somewhere to write.
                                     .withUserDataFolder (File::getSpecialLocation (File::tempDirectory).getChildFile (String (JucePlugin_Name) + " WebView")))
        .withNativeIntegrationEnabled()
        .withKeepPageLoadedWhenBrowserIsHidden()
        .withResourceProvider ([] (const String& url) { return serveEmbeddedUi (url); },
                               devServerUrl().isNotEmpty() ? std::optional<String> (URL (devServerUrl()).getOrigin()) : std::nullopt);

    return bridge.registerNativeFunctions (std::move (options));
}

void PluginEditor::paint (Graphics& g)
{
    g.fillAll (background);
}

void PluginEditor::resized()
{
    browser.setBounds (getLocalBounds());
}

void PluginEditor::changeListenerCallback (ChangeBroadcaster*)
{
    bridge.notifyStateReplaced();
}
