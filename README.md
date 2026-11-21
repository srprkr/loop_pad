# Plugin Starter

A starter template for instrument plugins (VST3, plus a Standalone app) on Windows and macOS. It has a React UI running inside the plugin window and a C++ DSP engine with no framework dependency. It started out as Obsidian Player, stripped back to the parts every plugin needs and one small working instrument.

What you get out of the box:

- **Builds and releases.** CMake with JUCE 8. CI builds Windows and macOS (universal binary) on every push and runs the tests. A version tag publishes a GitHub Release with per-platform zips and a Windows installer.
- **A web UI in the plugin window.** React, TypeScript, Tailwind and Vite, built into one `index.html` and embedded in the binary. A typed bridge runs in both directions, and a mock backend lets you work on the UI in a normal browser.
- **Plugin plumbing.** Host-automatable parameters with gestures, saved session state, JSON presets, sample loading (file dialog or drag and drop), an output meter, and the computer keyboard as a MIDI keyboard.
- **An example instrument.** A polyphonic sampler with one-shot or loop playback, draggable region markers, real-time tempo sync and Preserve Speed, an ADSR envelope, and 12/18/24 dB high-pass and low-pass filters.
- **Tests.** Engine unit tests (plain C++), plus an end-to-end test that loads the built VST3 in a minimal host, plays MIDI and checks that audio comes out.

## Starting a new plugin from this template

1. **Copy the repo** (for example with GitHub's "Use this template"), then clone it.
2. **Set the identity block** at the top of [CMakeLists.txt](CMakeLists.txt). Change all eight values:
   - `PRODUCT_NAME` is the name shown in DAWs. `PRODUCT_TARGET` is the same name without spaces.
   - `PRODUCT_BUNDLE_ID` and `PRODUCT_COMPANY` identify you and the product.
   - `PRODUCT_MANUFACTURER_CODE` is yours and stays the same for all your plugins. `PRODUCT_PLUGIN_CODE` must be unique for each plugin. DAWs use these two codes to tell plugins apart.
   - `PRODUCT_WINDOWS_APP_ID` needs a fresh GUID (`uuidgen`). Never change it after the first release.

   That one block is enough. CI, the installer, the preset and import folders, the window title and the UI header all read from it ([scripts/product-info.sh](scripts/product-info.sh)).

3. **Replace the example instrument.** The engine is [engine/](engine/) and the UI decks are [ui/src/decks/](ui/src/decks/). Keep the building blocks you need and delete the rest.
4. **Bump `PRODUCT_VERSION`** for each release.

### Where things go

| To change…               | Edit                                                                                                                                                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sound / DSP              | [engine/src/SamplerEngine.cpp](engine/src/SamplerEngine.cpp) and [engine/include/core/](engine/include/core/)                                                                                                                 |
| Add a parameter          | The four places listed at the top of [plugin/source/Parameters.h](plugin/source/Parameters.h)                                                                                                                                 |
| Call C++ from the UI     | Register a native function in [plugin/source/WebUiBridge.cpp](plugin/source/WebUiBridge.cpp), then add it to [ui/src/bridge/api.ts](ui/src/bridge/api.ts) and [ui/src/bridge/mockBackend.ts](ui/src/bridge/mockBackend.ts)    |
| Send live data to the UI | `EngineTelemetry` in [SamplerEngine.h](engine/include/core/SamplerEngine.h), then `timerCallback()` in [WebUiBridge.cpp](plugin/source/WebUiBridge.cpp), then `Telemetry` in [ui/src/bridge/types.ts](ui/src/bridge/types.ts) |
| Save non-parameter state | `getStateInformation` / `setStateInformation` in [plugin/source/PluginProcessor.cpp](plugin/source/PluginProcessor.cpp)                                                                                                       |
| Layout / screens         | [ui/src/App.tsx](ui/src/App.tsx), [ui/src/layout/](ui/src/layout/), [ui/src/decks/](ui/src/decks/)                                                                                                                            |
| Window size              | `designWidth` / `designHeight` in [plugin/source/PluginEditor.h](plugin/source/PluginEditor.h), and `DESIGN_WIDTH` / `DESIGN_HEIGHT` in [ui/src/App.tsx](ui/src/App.tsx)                                                      |

### Engine building blocks

These live in [engine/include/core/](engine/include/core/) and are independent of the example sampler:

- **`StretchPlayer`**: real-time time-stretch and pitch shift (WSOLA grains). Pitch and speed are set separately.
- **`RegionReader`**: plays a start/end region of a sample, with seamless loops and a pre-roll crossfade.
- **`StepClock`**: a sample-accurate beat-grid clock. It follows the host's song position while the transport plays and free-runs otherwise. Use it for sequencers, arpeggiators and quantized launches. The example sampler doesn't use it yet, but it has its own tests.
- **`LinearAdsr`**, **`Biquad`** / `designFilter`: the envelope and the 12/18/24 dB filters.
- **`Voice`**: one note through stretch, filters, envelope and pan, plus `quickFade()` for hard stops such as choke groups.

## Project layout

```
engine/    C++ DSP engine, no framework dependency (namespace core)
tests/     Engine unit tests (plain C++, run with ctest) and the end-to-end plugin host test
plugin/    JUCE plugin: parameters, state, presets, sample loading, and the web-view bridge to the UI
ui/        React + TypeScript + Tailwind UI (Vite), built into one self-contained index.html
installer/ Windows installer script and the macOS read-me shipped in the zip
scripts/   product-info.sh, which reads the identity block for CI
```

### How the parts fit together

```
 Host (DAW) ── MIDI / automation ──▶ PluginProcessor ──▶ core::SamplerEngine ──▶ audio
                                        ▲          │
                      native functions  │          │ events (parameters, playheads, meter)
                                        │          ▼
                        React UI in JUCE WebBrowserComponent (WebView2 / WKWebView / WebKitGTK)
```

- **UI to plugin.** The UI calls native functions such as `setParameter`, `browseForSample`, `noteOn` and `savePreset`. The C++ side is [plugin/source/WebUiBridge.cpp](plugin/source/WebUiBridge.cpp); the typed TypeScript side is [ui/src/bridge/api.ts](ui/src/bridge/api.ts).
- **Plugin to UI.** About 30 times a second, the plugin sends parameter changes made by the host, plus playheads, meter levels and the host tempo.
- **Audio thread safety.** The audio thread never waits on a lock or allocates memory. Samples are handed over through a mutex that the audio thread only try-locks, and old samples are freed on the main thread.
- **Where things are saved.** Parameter values, the sample's file path and the UI view settings are all stored in the DAW project. Presets hold parameters only.

## Building

Requirements:

- CMake 3.22 or newer
- A C++20 compiler: Visual Studio 2022 on Windows, Xcode 15 or newer on macOS, GCC or Clang on Linux
- Node.js 20 or newer (the version is pinned in `ui/.tool-versions`)
- Internet access on the first build (CMake downloads JUCE 8.0.9; npm installs the UI packages)

The examples below use the default `PRODUCT_NAME`, "Plugin Starter".

### macOS

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release        # universal binary (arm64 + x86_64) by default
cmake --build build --config Release --parallel
cp -R "build/plugin/PluginStarter_artefacts/Release/VST3/Plugin Starter.vst3" ~/Library/Audio/Plug-Ins/VST3/
```

### Windows

JUCE needs the WebView2 SDK from NuGet. Install it once from PowerShell:

```powershell
Register-PackageSource -provider NuGet -name nugetRepository -location https://www.nuget.org/api/v2
Install-Package Microsoft.Web.WebView2 -Scope CurrentUser -RequiredVersion 1.0.1901.177 -Source nugetRepository
```

Then build:

```powershell
cmake -S . -B build
cmake --build build --config Release --parallel
# Copy the bundle into C:\Program Files\Common Files\VST3\
```

The interface needs the Microsoft WebView2 runtime. Windows 11 includes it and most Windows 10 PCs already have it; the installer adds it where it's missing.

### Linux (development)

CI doesn't ship Linux builds, but the plugin and tests build on Linux, which is handy for development. You need the JUCE Linux dependencies, including `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libasound2-dev` and `libfreetype-dev`.

```bash
cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build && ctest --test-dir build --output-on-failure
```

Pass `-DJUCE_DIR=<path>` to use a local JUCE checkout instead of downloading one.

### Engine tests only

The engine tests don't need JUCE or Node:

```bash
cmake -S . -B build -DBUILD_PLUGIN=OFF && cmake --build build && ctest --test-dir build
```

## Releases and CI

[.github/workflows/build.yml](.github/workflows/build.yml) builds Windows and macOS on every push, runs both test suites, and uploads the VST3 and Standalone builds as artifacts. This is the easiest way to get Windows and macOS binaries if you develop on Linux.

To publish a release, raise `PRODUCT_VERSION`, merge that change to `main`, then tag and push:

```bash
git tag v0.1.0 && git push origin v0.1.0
```

CI then creates a GitHub Release with three files attached: `<target>-<version>-macOS.zip`, `<target>-<version>-Windows.zip` and the Windows Setup.exe. The release job stops if the tag doesn't match `PRODUCT_VERSION`. The macOS zip is made with `ditto`, so file permissions survive. It also contains [READ-ME-FIRST.txt](installer/macos/READ-ME-FIRST.txt), which explains how to open the unsigned build. The Windows installer ([installer/windows/Installer.iss](installer/windows/Installer.iss)) installs the VST3 to `C:\Program Files\Common Files\VST3`, installs the Standalone app with a Start menu entry, and adds WebView2 if it's missing.

## Working on the UI

```bash
cd ui
npm install
npm run dev        # http://localhost:5173, running against an in-browser mock (no sound)
```

In a normal browser, the mock backend keeps state in memory and decodes dropped files so the waveform shows. To see UI changes live inside the real plugin, configure with `-DUI_DEV_SERVER_URL=http://localhost:5173/`. The plugin then loads the UI from the Vite dev server instead of the embedded copy.

A normal build runs `npm ci` and `npm run build` automatically, then embeds `ui/dist/index.html` in the plugin binary.

## Distribution notes

- **Licence.** JUCE 8 is dual-licensed: AGPLv3, or a commercial licence (which includes a free tier for small companies). If you distribute closed-source binaries, you need a JUCE licence.
- **macOS.** Sign the bundle with a Developer ID and notarise it, otherwise Gatekeeper blocks it. For Logic Pro support, add `AU` to `FORMATS` in [plugin/CMakeLists.txt](plugin/CMakeLists.txt).
- **Plugin codes.** DAWs identify a plugin by its manufacturer and plugin codes. Set your own in the identity block before the first release, and don't change them afterwards, or existing projects will lose the plugin.
