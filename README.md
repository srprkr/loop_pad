# Loop Pad

A drum-pad instrument with a built-in loop recorder, as a VST3 plugin and a Standalone app for Windows and macOS. Play a grid of synthesized drum pads from the mouse, the computer keyboard or MIDI, press **REC**, and your hits loop back in time with the tempo.

It is built on the Plugin Starter template: a C++ DSP engine with no framework dependency, a React UI running inside the plugin window, and JUCE 8 in between. The design comes from a browser prototype, [source_code.jsx](source_code.jsx), and [BUILD_PLAN.md](BUILD_PLAN.md) records how the prototype was turned into the plugin.

## Using it

| Control | What it does |
|---|---|
| `3x3` / `4x4` / `5x5` | Shows one of three pad sets. Each set has its own layout and keeps your edits. |
| Pads | Click or press the pad's key to play it. Playing a pad also selects it (white ring). |
| `REC` | Counts in three beats, records exactly 4 bars, then loops what you played. Hits snap to the nearest 16th note. A new take replaces the loop. Press REC again during the count-in or recording to stop. |
| `PLAY` / `PAUSE` | Loops the recording from the start, or stops it. |
| Metronome button | Turns the click on or off. While recording, it flashes green on each beat. |
| BPM, `TAP` | Sets the tempo from 60 to 200 BPM. Type a value, use the arrows, or tap at least twice. In a DAW that's playing, the loop follows the DAW's tempo and the field is greyed out. |
| Speaker, `VOL` | Mute and master volume. |
| `EDIT` | Shows or hides the Pad Inspector for the selected pad: pitch (±12 semitones), volume (0–130%), its sound (one of 25), and its colour. Releasing a fader plays the pad; double-clicking a fader resets it. |

**Keys.** `1 2 3 4 5` / `Q W E R T` / `A S D F G` / `Z X C V B` / `Y U I O P`. Each grid size uses as many rows and columns as it has.

**MIDI.** Note 36 (C1) plays the first pad, and the following notes play the rest, row by row, in the grid that's showing. Velocity scales the pad's volume. MIDI hits are recorded like any others.

**Saved with the DAW project.** The parameters (volume, mute, tempo, metronome), all three pad sets, the recorded loop and the view settings.

## Project layout

```
engine/    C++ DSP engine, no framework dependency (namespace core)
tests/     Engine unit tests (plain C++, run with ctest) and the end-to-end plugin host test
plugin/    JUCE plugin: parameters, state, MIDI, and the web-view bridge to the UI
ui/        React + TypeScript + Tailwind UI (Vite), built into one self-contained index.html
installer/ Windows installer script and the macOS read-me shipped in the zip
scripts/   product-info.sh, which reads the identity block in CMakeLists.txt for CI
```

### How the parts fit together

```
 Host (DAW) ── MIDI / automation ──▶ PluginProcessor ──▶ core::LoopPadEngine ──▶ audio
                                        ▲          │        (DrumVoices + loop transport)
     native functions: pads, transport, │          │ events: parameters, transport, loop hits
                       kit, parameters  │          ▼
                        React UI in JUCE WebBrowserComponent (WebView2 / WKWebView / WebKitGTK)
```

- **The engine** ([engine/](engine/)). [`DrumKit`](engine/src/DrumKit.cpp) holds the 25 sounds as data. Each one is a Web Audio recipe from the prototype: oscillators with pitch sweeps, and filtered noise, shaped by exponential envelopes. A [`DrumVoice`](engine/src/DrumVoice.cpp) plays one sound in real time. [`LoopPadEngine`](engine/src/LoopPadEngine.cpp) runs 32 voices and handles master volume and mute, a soft clipper, and the loop transport. The transport is exact to the sample: count-in, a 64-step recording pass, playback and the metronome.
- **The plugin** ([plugin/source/](plugin/source/)). Pad hits and transport commands from the UI reach the audio thread through a lock-free queue. The engine reports loop changes and playback hits back the same way, and the plugin keeps a copy of the loop for saving the session. The UI owns the kit (the three pad sets) and sends the whole kit whenever it changes; the plugin saves it and uses the current set to map MIDI to pads.
- **The UI** ([ui/src/](ui/src/)). [`pluginStore.ts`](ui/src/state/pluginStore.ts) holds the state. The layout is [`TopBar`](ui/src/layout/TopBar.tsx), [`PadGrid`](ui/src/pads/PadGrid.tsx) and [`PadInspector`](ui/src/inspector/PadInspector.tsx). The kit list, colour themes and default pads are in [ui/src/data/](ui/src/data/).
- **Audio thread safety.** The audio thread never waits on a lock or allocates memory. The kit's MIDI table and a restored loop are handed over through a mutex that the audio thread only try-locks.

### Where things go

| To change… | Edit |
|---|---|
| A sound, or add one | The recipe in [engine/src/DrumKit.cpp](engine/src/DrumKit.cpp) and its entry in [ui/src/data/kit.ts](ui/src/data/kit.ts) (same id, same order); for the browser preview, also [ui/src/audio/webSynth.ts](ui/src/audio/webSynth.ts) |
| Default pad layouts | [ui/src/data/defaultPads.ts](ui/src/data/defaultPads.ts), plus `defaultPads` in [PluginProcessor.cpp](plugin/source/PluginProcessor.cpp) (the MIDI map before the UI first opens) |
| Pad colours | [ui/src/data/themes.ts](ui/src/data/themes.ts) |
| Loop length, count-in, quantizing | [engine/src/LoopPadEngine.cpp](engine/src/LoopPadEngine.cpp) (and the mock in [ui/src/bridge/mockBackend.ts](ui/src/bridge/mockBackend.ts)) |
| Add a parameter | The four places listed at the top of [plugin/source/Parameters.h](plugin/source/Parameters.h) |
| Call C++ from the UI | Register a native function in [plugin/source/WebUiBridge.cpp](plugin/source/WebUiBridge.cpp), then add it to [ui/src/bridge/api.ts](ui/src/bridge/api.ts) and [ui/src/bridge/mockBackend.ts](ui/src/bridge/mockBackend.ts) |
| Send live data to the UI | `EngineTelemetry` in [LoopPadEngine.h](engine/include/core/LoopPadEngine.h), then `timerCallback()` in [WebUiBridge.cpp](plugin/source/WebUiBridge.cpp), then `Telemetry` in [ui/src/bridge/types.ts](ui/src/bridge/types.ts) |
| Save non-parameter state | `getStateInformation` / `setStateInformation` in [plugin/source/PluginProcessor.cpp](plugin/source/PluginProcessor.cpp) |
| Window size | `designWidth` / `designHeight` in [plugin/source/PluginEditor.h](plugin/source/PluginEditor.h), and `DESIGN_WIDTH` / `DESIGN_HEIGHT` in [ui/src/App.tsx](ui/src/App.tsx) |
| Product name, codes, version | The identity block at the top of [CMakeLists.txt](CMakeLists.txt). `PRODUCT_COMPANY` and `PRODUCT_MANUFACTURER_CODE` are still the template's placeholders: set them before the first release, and never change the codes afterwards. |

## Building

Requirements:

- CMake 3.22 or newer
- A C++20 compiler: Visual Studio 2022 on Windows, Xcode 15 or newer on macOS, GCC or Clang on Linux
- Node.js 20 or newer (the version is pinned in `ui/.tool-versions`)
- Internet access on the first build (CMake downloads JUCE 8.0.9; npm installs the UI packages)

The examples below use `PRODUCT_NAME` "Loop Pad".

### macOS

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release        # universal binary (arm64 + x86_64) by default
cmake --build build --config Release --parallel
cp -R "build/plugin/LoopPad_artefacts/Release/VST3/Loop Pad.vst3" ~/Library/Audio/Plug-Ins/VST3/
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

The build applies a small patch to JUCE ([cmake/patches/juce-linux-webview-ipc.patch](cmake/patches/juce-linux-webview-ipc.patch)). It fixes JUCE 8.0.9's Linux web view, which crashed with `std::bad_alloc` once a message to the UI was larger than about 4 KB. If you use your own JUCE checkout with `-DJUCE_DIR`, apply the patch to it yourself.

To run the Standalone app: `./build/plugin/LoopPad_artefacts/Release/Standalone/"Loop Pad"`. VS Code installed as a snap gives its terminal snap library paths, and the app then fails with `undefined symbol: __libc_pthread_init`. Run it from a normal terminal instead, or strip the snap environment first:

```bash
env -i HOME="$HOME" PATH=/usr/bin:/bin DISPLAY="$DISPLAY" WAYLAND_DISPLAY="$WAYLAND_DISPLAY" \
    XDG_RUNTIME_DIR="$XDG_RUNTIME_DIR" DBUS_SESSION_BUS_ADDRESS="$DBUS_SESSION_BUS_ADDRESS" \
    ./build/plugin/LoopPad_artefacts/Release/Standalone/"Loop Pad"
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
npm run dev        # http://localhost:5173
```

In a normal browser, the mock backend ([ui/src/bridge/mockBackend.ts](ui/src/bridge/mockBackend.ts)) stands in for the plugin. It runs the prototype's Web Audio synth and loop transport, so pads, recording, playback and the metronome all make sound; click the page once so the browser allows audio. It is also the reference to compare the C++ sounds against.

To see UI changes live inside the real plugin, configure with `-DUI_DEV_SERVER_URL=http://localhost:5173/`. The plugin then loads the UI from the Vite dev server instead of the embedded copy.

A normal build runs `npm ci` and `npm run build` automatically, then embeds `ui/dist/index.html` in the plugin binary.

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
