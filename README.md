# Loop Pad

A drum-pad loop recorder in the browser. Play a grid of synthesized drum pads with the mouse or the computer keyboard, press **REC**, and your hits loop back in time with the tempo. All the sound is made live with Web Audio: there are no sample files.

The design comes from a browser prototype, [source_code.jsx](source_code.jsx).

## Running it

Needs Node.js 20 or newer (the version is pinned in `.tool-versions`).

```bash
npm install
npm run dev        # http://localhost:5173, live-reloads as you edit
npm run build      # typechecks, then writes the static site to dist/
npm run preview    # serves dist/ to check the production build
npm test           # unit tests (Vitest)
npm run test:e2e   # browser tests (Playwright); starts the dev server if it isn't running
```

`dist/` is a plain static site with relative paths, so it can be hosted anywhere (GitHub Pages, Netlify, any web server) or opened from a sub-folder.

Browsers start audio only after you interact with the page, so click it (or press a key) once before expecting sound.

## Using it

| Control | What it does |
|---|---|
| `3x3` / `4x4` / `5x5` | Shows one of three pad sets. Each set has its own layout and keeps your edits. |
| Pads | Click or press the pad's key to play it. Playing a pad also selects it (white ring). |
| `REC` | Counts in three beats, records exactly 4 bars, then loops what you played. Hits snap to the nearest 16th note. A new take replaces the loop. Press REC again during the count-in or recording to stop. |
| `PLAY` / `PAUSE` | Loops the recording from the start, or stops it. |
| Metronome button | Turns the click on or off. While recording, it flashes green on each beat. |
| BPM, `TAP` | Sets the tempo from 60 to 200 BPM. Type a value, use the arrows, or tap at least twice. |
| Speaker, `VOL` | Mute and master volume. |
| `EDIT` | Shows or hides the Pad Inspector for the selected pad: pitch (±12 semitones), volume (0–130%), its sound (one of 25), and its colour. Releasing a fader plays the pad; double-clicking a fader resets it. |

**Touch screens.** Pads, transport buttons and faders work by touch, and several pads can be played at once. Double-tap a fader to reset it. On iPhones the pads play even with the silent switch on (Safari 16.4 and later).

**Keys.** `1 2 3 4 5` / `Q W E R T` / `A S D F G` / `Z X C V B` / `Y U I O P`. Each grid size uses as many rows and columns as it has.

**Saved in the browser.** Volume, mute, tempo and metronome, all three pad sets, the open/closed inspector, the selected pads and the recorded loop are kept in `localStorage`, so a reload comes back where you left off. To reset everything, clear the site's data in the browser, or run `localStorage.removeItem("loop-pad:v1")` in the console.

## How it works

```
src/
  audio/webSynth.ts            the 25 drum sounds and the metronome click, as Web Audio graphs
  audio/transport.ts           the loop rules as pure functions (modes, quantizing, step actions)
  audio/engine.ts              applies them on the Web Audio clock (count-in, recording, playback)
  state/store.ts               app state (zustand), pad flashes
  state/persistence.ts         saving to and restoring from localStorage
  layout/TopBar.tsx            grid size, transport, tempo, volume
  pads/PadGrid.tsx             the pads
  inspector/PadInspector.tsx   pitch / volume faders, sound, colour
  data/                        the kit list, colour themes and default pad layouts
```

- **Sounds** ([webSynth.ts](src/audio/webSynth.ts)). Each pad hit builds a small Web Audio graph: oscillators with pitch sweeps and filtered noise, shaped by exponential envelopes. Pitch scales the recipe's frequencies; it doesn't resample.
- **Timing** ([engine.ts](src/audio/engine.ts)). A scheduler runs every 25 ms and queues the next 100 ms of steps on the Web Audio clock, so clicks and loop hits land exactly on the beat. A hit you play is placed at the nearest 16th by comparing its time to that clock. The UI reads the engine's state about 30 times a second.

### Where things go

| To change… | Edit |
|---|---|
| A sound, or add one | Its recipe in [src/audio/webSynth.ts](src/audio/webSynth.ts) and its entry in [src/data/kit.ts](src/data/kit.ts) (same id) |
| Default pad layouts | [src/data/defaultPads.ts](src/data/defaultPads.ts) |
| Pad colours | [src/data/themes.ts](src/data/themes.ts) |
| Loop length, count-in, quantizing, metronome pattern | [src/audio/transport.ts](src/audio/transport.ts) |
| Defaults, BPM range | [src/state/defaults.ts](src/state/defaults.ts) |
| Layout size | `DESIGN_WIDTH` / `DESIGN_HEIGHT` in [src/App.tsx](src/App.tsx). The layout is designed at 720 × 1080 and scaled to fit the window. |

## Testing

- **Unit tests** ([src/audio/transport.test.ts](src/audio/transport.test.ts), [src/state/persistence.test.ts](src/state/persistence.test.ts)) check the loop rules without audio: count-in, the 4-bar take and the switch to playback, snapping to the nearest 16th (including the count-in and end-of-loop edges), same-sound replacement, the metronome pattern, TAP tempo, and that saved state is restored and bad saved data is ignored. They take under a second.
- **Browser tests** ([e2e/](e2e/)) click through the real app in headless Chromium with real Web Audio: the layout and EDIT, grid sizes and keys, REC → count-in → recording → automatic playback with the hit played back, PLAY / PAUSE, TAP, and settings and a recorded loop surviving a reload. A phone-emulation run checks that the first tap makes sound, taps select pads, the layout fits the screen, transport buttons work by touch and faders reset on a double tap. They run at 200 BPM to stay quick (about 15 s in total) and fail on any page error. Sound is checked by tapping the app's output into an analyser. The first run needs a browser: `npx playwright install chromium`.

## CI

[.github/workflows/build.yml](.github/workflows/build.yml) runs the unit tests, typechecks and builds, uploads `dist/` as an artifact, and runs the browser tests, on pull requests and pushes to `main`. It uses Linux only (the cheapest runner). Docs-only changes are skipped. If jobs fail within seconds with no steps, check **Settings → Billing** on GitHub: Actions stops starting jobs when the minutes or spending limit run out.
