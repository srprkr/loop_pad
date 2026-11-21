# Loop Pad — Build Plan (draft for review)

> **Status:** built. Steps 0–5 are done on the `loop-pad` branch, one commit per step (Steps 1 and 2 share one). See **Build status** at the end for what changed from this plan.
> **Reference:** [`source_code.jsx`](source_code.jsx) is a working browser prototype (React + Web Audio, one file). It is the spec for behaviour and look. Line references below (`source_code:NNN`) point into it.

Loop Pad is a drum-pad instrument (VST3 + Standalone). It has a 3x3, 4x4 or 5x5 grid of synthesized drum pads, a pad inspector, and a 4-bar loop recorder with count-in and metronome.

## What the prototype defines

### Top bar (`source_code:1080-1240`)

| Control | Behaviour |
|---|---|
| `3x3` / `4x4` / `5x5` | Switches between three **separate pad sets**, each with its own default layout (`DEFAULT_PADS_3X3/4X4/5X5`, `:142-199`). Edits to a set are kept when you switch away. Switching selects that set's first pad. |
| `REC` | Starts a **3-beat count-in** (high woodblock click, first beat accented). It then **records exactly 4 bars** (64 sixteenth steps), **replacing** the previous loop, and **automatically switches to looping playback** after step 63. Pressing REC during the count-in or recording stops the transport. The label shows `COUNT` during the count-in, and the button pulses red. |
| `PLAY` / `PAUSE` | Toggles loop playback. Playback always starts from step 0, so PAUSE behaves like a stop. If nothing is recorded, PLAY just runs the metronome. |
| Metronome button | Turns the click on or off. While enabled it clicks on every quarter note during the count-in, recording and playback, with a stronger accent on each bar's downbeat (1600 Hz vs 1000 Hz). During recording the button flashes green on each beat. |
| BPM field + `TAP` | 60–200 BPM, default 120. TAP averages the intervals between taps made within the last 3 s, needs at least 2 taps, and clamps to 60–200. Tempo changes take effect at the next step. |
| Mute + `VOL` | Master gain from 0 to 100%, default 85%. Mute shows 0%. Moving the slider unmutes. |

### Pads (`source_code:1243-1315`)
- **Pointer down** plays the pad *and* selects it. The pad flashes in its theme's solid "active" colour for 120 ms. During playback, pads flash for 90 ms when the loop plays them.
- The pad shows its key badge (top left), its name, its category (uppercase) and its pitch offset (bottom right, only if it isn't 0).
- **Selected pad:** white ring only. The prototype also draws a pulsing white dot; it is dropped, because the ring is enough (your answer).
- **Keyboard map** (key presses trigger the pad, but not while you're typing in an input or select):

  | Grid | Rows |
  |---|---|
  | 3x3 | `1 2 3` / `Q W E` / `A S D` |
  | 4x4 | `1 2 3 4` / `Q W E R` / `A S D F` / `Z X C V` |
  | 5x5 | `1 2 3 4 5` / `Q W E R T` / `A S D F G` / `Z X C V B` / `Y U I O P` |

### EDIT + Pad Inspector (`source_code:1318-1487`)
- **EDIT shows or hides the Pad Inspector** (EDIT is indigo while it's open; the mockup shows it open).
- The inspector header reads `PAD INSPECTOR: [key] NAME`.
- **Pitch fader:** −12 … +12 st in steps of 1. **Volume fader:** 0 … 130% in steps of 2%, default 100%. Releasing a fader plays the pad's sound. Double-clicking resets the value (0 st / 100%) and plays the sound.
- **Audio Sample select:** lists all 25 kit sounds as `Label (CATEGORY)`. Choosing one **renames the pad** to the sound's label, sets its category, and plays it.
- **Pad Color:** 10 swatches. The theme name is shown below them.

### Kit: 25 synthesized sounds (`source_code:84-121`, recipes `:342-850`)
There are no audio files. Each sound is a small synth recipe built from oscillators with exponential pitch sweeps, white noise through biquad filters, and exponential decays. **Pitch scales the recipe's frequencies** (and the decay for the hats and shaker). It does not resample.

| Category | Sounds |
|---|---|
| KICK | Punch Kick, Sub 808, Thud Kick, Click Kick |
| SNARE | Tight Snare, Fat Snare, Clap, Rimshot |
| HIHAT | Closed Hat, Open Hat, Pedal Hat |
| TOM | High Tom, Mid Tom, Low Tom, Floor Tom |
| PERC | Splash Cymbal, Crash Cymbal, Shaker, Tambourine, Cowbell, Woodblock, Agogo Bell, Stick Click |
| FX | Laser FX, Noise Drop FX |

### Colour themes (`source_code:15-76`)
Amber Gold, Rose Red, Emerald Green, Cyan Sky, Neon Orange, Deep Purple, Electric Fuchsia, Violet Indigo, Cobalt Blue, Volt Lime. Each theme has a gradient class, an active colour and a hex accent.

### Loop data (`source_code:134-140`, `:859-885`)
- Each recorded hit is stored as `{ step 0–63, soundType, pitchSemitones, volume, padKey }`. That's a **snapshot of the pad at record time**, so editing the pad afterwards doesn't change the loop.
- Hits are quantized to the **nearest 16th** and wrap modulo 64. A second hit of the same sound on the same step replaces the first one.

## Build steps

Each step ends in a working, testable state. We review between steps.

### Step 0: Project identity and window
- Set the identity block in [CMakeLists.txt](CMakeLists.txt): `Loop Pad` / `LoopPad`, a new plugin code and a new Windows GUID. The company and manufacturer code depend on Q3.
- Window: a portrait design size of **720 × 1080**, scaled to fit and resizable. Set it in `PluginEditor.h` and `App.tsx`. The prototype's frame is `max-w-2xl` (672 px), or `max-w-3xl` for 5x5. The window is fixed, so it is sized for the open inspector; when the inspector is closed, the grid sits higher up and the space below stays empty.

### Step 1: Drum synth engine (C++, `engine/`)
- Add `core::DrumSynth`: real-time voices that run the 25 recipes. Each recipe is a list of layers:
  - **Tone layer:** sine, triangle, square or saw; start frequency → end frequency with an exponential sweep over a set time; peak gain → exponential decay; stop time.
  - **Noise layer:** white noise → 1 or 2 biquads (HP / BP / LP, Q, optional exponential cutoff sweep), with a gain envelope (an optional linear attack, as in the shaker).
  - **Burst layer:** repeated noise bursts at set offsets (the clap's 0, 12 and 24 ms hits plus its tail).
- All 25 recipes are a **data table** copied from the prototype's numbers. The pitch ratio `2^(st/12)` scales the frequencies, cutoffs clamp at 18 kHz, and the hat and shaker decays are divided by `max(0.5, ratio)`, exactly as in the prototype.
- **Keep `Biquad`** (we need it to match Web Audio's `BiquadFilterNode` responses). Delete `SamplerEngine`, `StretchPlayer`, `RegionReader`, `Envelope`, `Voice`, `SampleData` and `StepClock`'s unused paths only after the new engine is passing its tests (Q4).
- Use a voice pool of 32 voices with oldest-voice stealing and a short fade on the stolen voice. Exponential ramps go to 0.001, as in Web Audio.
- Master gain uses a smoothed version of the prototype's `setTargetAtTime(…, 0.01)`. Add a soft clipper on the output, because pad volume goes up to 130% and several kicks together can go over 0 dBFS (Q6).
- **Tests:** every recipe produces sound and ends within its stop time; pitch +12 doubles the tone layer's frequency; volume and mute work; voice stealing works; there are no NaN or denormal values.

### Step 2: Transport and loop recorder (C++, `engine/`)
- Add `core::LoopTransport`, a state machine with the states `Idle → CountIn (3 beats) → Recording (64 steps) → Playing`, and `Playing ↔ Idle`. Its timing is accurate to the sample and built on `StepClock` with a 1/16 tick.
- Recording works the same way as `source_code:859-885`: a hit is quantized to the nearest step (`round((now − nextStepTime) / stepLen)` relative to the current step), stored as a snapshot, and replaces any same-sound hit on the same step. Recording clears the loop when the count-in ends.
- Playback plays the stored hits on their step, with sample-accurate offsets (the prototype schedules 100 ms ahead with `requestAnimationFrame`; we don't need that inside a plugin).
- **Metronome:** count-in click (2400/2000 Hz falling to 800 Hz over 20 ms, 25 ms decay) and main click (1600/1000 Hz, 35 ms decay). Both go through master gain, as in the prototype.
- **Tests:** count-in length; recording ends at step 63 and playback starts on the next step without a gap; quantizing to the nearest step around step boundaries and the 63→0 wrap; same-step replacement; a tempo change mid-loop; starting and stopping in the middle of a block.

### Step 3: Plugin layer (`plugin/`)
- **Automatable parameters:** `masterVolume`, `mute`, `bpm` (60–200), `metronome`. Per-pad pitch and volume are **not** host parameters, because there are three separate pad sets (59 pads); they are saved as state (Q5). Remove all the old sampler parameters.
- **Saved state** (`get/setStateInformation`): grid size, selected pad for each set, the three pad sets (`name, category, soundType, colorKey, key, pitch, volume`), the recorded loop, and whether the inspector is open.
- **Bridge functions:** `triggerPad(soundType, pitch, volume, padKey)`, `updatePad(grid, index, partial)`, `setGridSize`, `record`, `togglePlay`, `stop`, `tapTempo` (or do the tapping in the UI and set `bpm`), and `previewSound`.
- **Bridge events** (about 30 Hz): transport state, current step, beat flashes, pad hits from loop playback (by `padKey`), and the meter.
- **MIDI in:** note 36 + *n* → pad *n* of the current grid, row by row, so a DAW or controller can play the pads (Q2).
- **Presets:** none for v1, because the prototype has none and the state saves with the DAW project (Q7).

### Step 4: UI (`ui/`)
- Port `source_code` into the existing Vite/Tailwind app. Remove `decks/`, `MasterTabBar`, the waveform code and the preset browser.
- Split it into components and keep the prototype's Tailwind classes:
  - `layout/TopBar`, made of `GridSizeToggle`, `Transport` (REC / PLAY / metronome SVG / BPM / TAP) and `VolumeControl`;
  - `pads/PadGrid` and `pads/Pad`;
  - `inspector/PadInspector`, made of `VerticalFader` ×2, `SampleSelect` and `ColorPalette`;
  - `data/kit.ts` (sound list), `data/themes.ts` and `data/defaultPads.ts`.
- State lives in the zustand store and is mirrored to the plugin. The plugin owns the transport and audio; the UI only sends commands and draws the state.
- Replace `useComputerKeyboard` with the grid-aware pad map above.
- **Mock backend:** reuse the prototype's Web Audio synth and scheduler, so `npm run dev` still makes sound in a browser. This also gives us an A/B reference to compare the C++ sounds against.
- Check the Tailwind config covers the classes the theme map builds (`from-amber-600/40` etc.) by listing them in full, not building them from strings.

### Step 5: Tests, CI, docs
- `tests/plugin-host`: load the VST3, send MIDI note 36, and check for audio. Then run record → hit → loop and check that the hit plays back one loop later.
- An optional engine test that renders each recipe and compares its spectrum and envelope against reference renders exported from the prototype in the browser.
- Rewrite README.md as the Loop Pad guide.

## Prototype quirks — decide whether to copy

These are in `source_code`. My recommendation is in **bold**.

1. Hits during the 3-beat count-in are **dropped**. A hit just before the downbeat is lost. → **Record hits in the last ½ step of the count-in onto step 0.**
2. You **can't overdub**: each REC replaces the whole loop, and you can't add hits to a loop that is playing. → **Keep it for v1** (matches the prototype).
3. Loop hits flash a pad by matching `padKey` in the *current* grid. After a grid switch they can flash the wrong pad, or none. → **Flash only if the pad's `soundType` also matches.**
4. `metronomeFlash` has a `"red"` state that is never set. → **Drop it.**
5. Starting REC while the loop is playing stops playback and goes straight into the count-in. → **Keep it.**
6. Pad volume up to 130% can clip. → **Soft clip on the output** (Step 1).

## Open questions (answered)

1. **The window:** is 720 × 1080 (portrait, sized for the open inspector) OK?
2. **MIDI:** should incoming MIDI notes play pads (36 + *n*)? Should the loop follow the DAW's tempo and play/stop, or always run on its own BPM? *Proposed: MIDI plays pads; the loop runs on its own transport but uses the host's tempo while the host is playing.*
3. **Identity:** the company name and 4-character manufacturer code (or keep the placeholders).
4. **Old sampler code:** delete it once replaced, or keep it in `engine/` for later? *Proposed: delete everything except `Biquad` and `StepClock`.*
5. **Per-pad automation:** OK that pad pitch and volume can't be automated from the DAW?
6. **Soft clipper** on the master output: OK to add one, even though the prototype doesn't have it?
7. **Presets:** none for v1?
8. **Should `source_code` move** to `reference/prototype.tsx`, so it gets syntax highlighting and is clearly not part of the build?

### Answers

- **EDIT** only shows or hides the inspector panel.
- **The dot** on the selected pad is dropped; the ring is enough.
- **The loop** is 4 bars (64 steps), as in the prototype.
- **The fifth row in 5x5** uses `Y U I O P`.
- **Everything else** uses the proposals above: a 720 × 1080 window; MIDI plays the pads, and the loop runs on its own transport but uses the host's tempo while the host plays; placeholder company and manufacturer code; the old sampler code deleted (`Biquad` and `StepClock` kept); per-pad settings saved as state, not host parameters; a soft clipper; no presets. Of the prototype quirks, 1, 3, 4 and 6 are fixed, and 2 and 5 are kept as the prototype has them.

## Build status

| Step | Commit | Notes |
|---|---|---|
| 0 Identity + window | `Step 0: …` | `Loop Pad` / `LoopPad` / `Lpd1`, a new Windows GUID, VST3 category `Instrument|Drum`. The window opens at 600 × 900 (5/6 scale) so it fits a 1080p screen, and resizes from 2/3 to 2× scale. |
| 4 UI | `Step 4: …` | Built **before** the C++ steps so it could be watched live with `npm run dev`. The mock backend runs the prototype's synth and transport. |
| 1 + 2 Engine | `Steps 1-2: …` | `DrumKit` (recipes as data), `DrumVoice`, `LoopPadEngine`. 28 engine tests. |
| 3 Plugin | `Step 3: …` | Parameters, processor, bridge, and the end-to-end host test. |
| 5 Docs | `Step 5: …` | README rewritten as the Loop Pad guide; this file updated. |

**Changes from the plan**

- **The transport doesn't use `StepClock`.** Quantizing needs the exact position *between* steps when a hit lands, so the engine keeps its own position in steps, accurate to the sample. That position is calculated from the last tempo change, not added up sample by sample, because a test showed a running sum drifting one sample late after a few loops. `StepClock` and its tests are kept as a building block.
- **MIDI works before the UI has ever opened.** The processor starts with the default 4x4 map. Without it, a session where nobody opened the window would play silence.
- **The loop-playback test in the host test was replaced** with checks that the loop and kit survive saving and reloading. The transport is driven from the UI, which a VST3 host can't do. The engine tests cover the record → loop → playback cycle at exact sample times.
- **The BPM field commits on Enter or blur** (the arrows apply at once). The prototype clamped on every keystroke, so typing "140" went to 60 after the first "1".
- **Several pads can flash at once** (for example a kick and a hat on the same step). The prototype could only flash one pad at a time.

**Not done / to check by hand**

- **The sounds have not been compared by ear.** The C++ recipes use the prototype's numbers, and tests check frequencies, sweeps and decays, but nobody has yet listened to the browser (`npm run dev`) and the plugin side by side.
- **The plugin UI was tested in a browser, not inside a DAW.** The real JUCE web view (WebKitGTK, WebView2, WKWebView) hasn't been opened. Run the Standalone app to check it (see README).
- **`PRODUCT_COMPANY` and `PRODUCT_MANUFACTURER_CODE`** are still placeholders.
