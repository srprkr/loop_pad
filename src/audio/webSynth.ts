// Web Audio drum synth, ported verbatim from the prototype (refs/source_code.jsx:294-851).
// Used by the browser mock backend so `npm run dev` makes sound, and as the A/B reference for
// the C++ engine (engine/src/DrumKit.cpp), which implements the same recipes.

const getPitchMultiplier = (semitones: number) => Math.pow(2, semitones / 12);

/** Two seconds of white noise, shared by every noise-based sound. */
export function createNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const bufferSize = ctx.sampleRate * 2;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

/** Metronome click. Count-in clicks are higher and hollower; the accent marks beat 1. */
export function playMetronomeClick(ctx: BaseAudioContext, master: AudioNode, time: number, isCountIn: boolean, isAccent: boolean) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.connect(gain);
  gain.connect(master);
  osc.start(time);
  if (isCountIn) {
    osc.frequency.setValueAtTime(isAccent ? 2400 : 2000, time);
    osc.frequency.exponentialRampToValueAtTime(800, time + 0.02);
    gain.gain.setValueAtTime(0.45, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.025);
    osc.stop(time + 0.03);
  } else {
    osc.frequency.setValueAtTime(isAccent ? 1600 : 1000, time);
    gain.gain.setValueAtTime(0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
    osc.stop(time + 0.04);
  }
}

/** Plays one kit sound at `t` (audio-context time) into `master`. */
export function triggerSound(
  ctx: BaseAudioContext,
  master: AudioNode,
  noise: AudioBuffer,
  soundType: string,
  pitchSemitones: number,
  padVol: number,
  t: number,
) {
  const pitch = getPitchMultiplier(pitchSemitones);

  // Dedicated pad gain
  const padGain = ctx.createGain();
  padGain.gain.setValueAtTime(padVol, t);
  padGain.connect(master);

  switch (soundType) {
    case "closed_hat": {
      const source = ctx.createBufferSource();
      source.buffer = noise;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(Math.min(18000, 7000 * pitch), t);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.7, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06 / Math.max(0.5, pitch));

      source.connect(filter);
      filter.connect(gain);
      gain.connect(padGain);
      source.start(t);
      source.stop(t + 0.08);
      break;
    }

    case "pedal_hat": {
      const source = ctx.createBufferSource();
      source.buffer = noise;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(Math.min(18000, 5000 * pitch), t);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12 / Math.max(0.5, pitch));

      source.connect(filter);
      filter.connect(gain);
      gain.connect(padGain);
      source.start(t);
      source.stop(t + 0.14);
      break;
    }

    case "open_hat": {
      const source = ctx.createBufferSource();
      source.buffer = noise;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(Math.min(18000, 6000 * pitch), t);

      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.setValueAtTime(Math.min(18000, 8000 * pitch), t);
      band.Q.setValueAtTime(2.0, t);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.65, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38 / Math.max(0.5, pitch));

      source.connect(filter);
      filter.connect(band);
      band.connect(gain);
      gain.connect(padGain);
      source.start(t);
      source.stop(t + 0.4);
      break;
    }

    case "shaker": {
      const source = ctx.createBufferSource();
      source.buffer = noise;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(Math.min(18000, 5500 * pitch), t);
      filter.Q.setValueAtTime(1.5, t);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(0.45, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09 / Math.max(0.5, pitch));

      source.connect(filter);
      filter.connect(gain);
      gain.connect(padGain);
      source.start(t);
      source.stop(t + 0.1);
      break;
    }

    case "splash": {
      const source = ctx.createBufferSource();
      source.buffer = noise;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(Math.min(18000, 5000 * pitch), t);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.7, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(padGain);
      source.start(t);
      source.stop(t + 0.75);
      break;
    }

    case "crash": {
      const source = ctx.createBufferSource();
      source.buffer = noise;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(Math.min(18000, 4500 * pitch), t);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.8, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(padGain);
      source.start(t);
      source.stop(t + 1.25);
      break;
    }

    case "stick_click": {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(1200 * pitch, t);
      gain.gain.setValueAtTime(0.6, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
      osc.connect(gain);
      gain.connect(padGain);
      osc.start(t);
      osc.stop(t + 0.02);
      break;
    }

    case "clap": {
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(Math.min(18000, 1100 * pitch), t);
      filter.Q.setValueAtTime(1.8, t);

      const masterClap = ctx.createGain();
      masterClap.connect(padGain);
      filter.connect(masterClap);

      [0, 0.012, 0.024].forEach((offset) => {
        const s = ctx.createBufferSource();
        s.buffer = noise;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.5, t + offset);
        g.gain.exponentialRampToValueAtTime(0.01, t + offset + 0.015);
        s.connect(g);
        g.connect(filter);
        s.start(t + offset);
        s.stop(t + offset + 0.02);
      });

      const mainS = ctx.createBufferSource();
      mainS.buffer = noise;
      const mainG = ctx.createGain();
      mainG.gain.setValueAtTime(0.8, t + 0.036);
      mainG.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      mainS.connect(mainG);
      mainG.connect(filter);
      mainS.start(t + 0.036);
      mainS.stop(t + 0.25);
      break;
    }

    case "tight_snare": {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(190 * pitch, t);
      osc.frequency.exponentialRampToValueAtTime(75 * pitch, t + 0.08);
      oscGain.gain.setValueAtTime(0.9, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(oscGain);
      oscGain.connect(padGain);
      osc.start(t);
      osc.stop(t + 0.14);

      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noise;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(Math.min(18000, 1500 * pitch), t);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.7, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

      noiseSrc.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(padGain);
      noiseSrc.start(t);
      noiseSrc.stop(t + 0.2);
      break;
    }

    case "fat_snare": {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(160 * pitch, t);
      osc.frequency.exponentialRampToValueAtTime(65 * pitch, t + 0.12);
      oscGain.gain.setValueAtTime(1.0, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(oscGain);
      oscGain.connect(padGain);
      osc.start(t);
      osc.stop(t + 0.25);

      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noise;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(Math.min(18000, 4000 * pitch), t);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.8, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);

      noiseSrc.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(padGain);
      noiseSrc.start(t);
      noiseSrc.stop(t + 0.28);
      break;
    }

    case "rimshot": {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(780 * pitch, t);
      osc.frequency.exponentialRampToValueAtTime(420 * pitch, t + 0.03);
      oscGain.gain.setValueAtTime(0.8, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
      osc.connect(oscGain);
      oscGain.connect(padGain);
      osc.start(t);
      osc.stop(t + 0.05);

      const click = ctx.createBufferSource();
      click.buffer = noise;
      const clickF = ctx.createBiquadFilter();
      clickF.type = "bandpass";
      clickF.frequency.setValueAtTime(Math.min(18000, 3200 * pitch), t);
      clickF.Q.setValueAtTime(4.0, t);
      const clickG = ctx.createGain();
      clickG.gain.setValueAtTime(0.6, t);
      clickG.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
      click.connect(clickF);
      clickF.connect(clickG);
      clickG.connect(padGain);
      click.start(t);
      click.stop(t + 0.03);
      break;
    }

    case "cowbell": {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = "square";
      osc2.type = "square";
      osc1.frequency.setValueAtTime(540 * pitch, t);
      osc2.frequency.setValueAtTime(800 * pitch, t);

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(Math.min(18000, 740 * pitch), t);
      filter.Q.setValueAtTime(3.5, t);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.7, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(padGain);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.38);
      osc2.stop(t + 0.38);
      break;
    }

    case "tambourine": {
      const source = ctx.createBufferSource();
      source.buffer = noise;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(Math.min(18000, 7500 * pitch), t);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.75, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(padGain);
      source.start(t);
      source.stop(t + 0.18);
      break;
    }

    case "woodblock": {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(950 * pitch, t);
      osc.frequency.exponentialRampToValueAtTime(500 * pitch, t + 0.04);
      gain.gain.setValueAtTime(0.8, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.connect(gain);
      gain.connect(padGain);
      osc.start(t);
      osc.stop(t + 0.07);
      break;
    }

    case "agogo": {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(1150 * pitch, t);
      gain.gain.setValueAtTime(0.75, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain);
      gain.connect(padGain);
      osc.start(t);
      osc.stop(t + 0.22);
      break;
    }

    case "high_tom": {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(240 * pitch, t);
      osc.frequency.exponentialRampToValueAtTime(140 * pitch, t + 0.18);
      gain.gain.setValueAtTime(0.85, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(padGain);
      osc.start(t);
      osc.stop(t + 0.3);
      break;
    }

    case "mid_tom": {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(180 * pitch, t);
      osc.frequency.exponentialRampToValueAtTime(105 * pitch, t + 0.22);
      gain.gain.setValueAtTime(0.85, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(gain);
      gain.connect(padGain);
      osc.start(t);
      osc.stop(t + 0.35);
      break;
    }

    case "low_tom": {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(130 * pitch, t);
      osc.frequency.exponentialRampToValueAtTime(70 * pitch, t + 0.26);
      gain.gain.setValueAtTime(0.9, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.connect(gain);
      gain.connect(padGain);
      osc.start(t);
      osc.stop(t + 0.4);
      break;
    }

    case "floor_tom": {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(95 * pitch, t);
      osc.frequency.exponentialRampToValueAtTime(50 * pitch, t + 0.35);
      gain.gain.setValueAtTime(0.95, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(gain);
      gain.connect(padGain);
      osc.start(t);
      osc.stop(t + 0.5);
      break;
    }

    case "laser_fx": {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(1600 * pitch, t);
      osc.frequency.exponentialRampToValueAtTime(120 * pitch, t + 0.18);
      gain.gain.setValueAtTime(0.65, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain);
      gain.connect(padGain);
      osc.start(t);
      osc.stop(t + 0.25);
      break;
    }

    case "click_kick": {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(220 * pitch, t);
      osc.frequency.exponentialRampToValueAtTime(50 * pitch, t + 0.06);
      gain.gain.setValueAtTime(1.0, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain);
      gain.connect(padGain);
      osc.start(t);
      osc.stop(t + 0.2);
      break;
    }

    case "punch_kick": {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(160 * pitch, t);
      osc.frequency.exponentialRampToValueAtTime(45 * pitch, t + 0.08);
      gain.gain.setValueAtTime(1.0, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(gain);
      gain.connect(padGain);
      osc.start(t);
      osc.stop(t + 0.26);

      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = "square";
      clickOsc.frequency.setValueAtTime(250 * pitch, t);
      clickOsc.frequency.exponentialRampToValueAtTime(40 * pitch, t + 0.02);
      clickGain.gain.setValueAtTime(0.4, t);
      clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
      clickOsc.connect(clickGain);
      clickGain.connect(padGain);
      clickOsc.start(t);
      clickOsc.stop(t + 0.03);
      break;
    }

    case "sub_808": {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(120 * pitch, t);
      osc.frequency.exponentialRampToValueAtTime(42 * pitch, t + 0.12);
      gain.gain.setValueAtTime(1.0, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
      osc.connect(gain);
      gain.connect(padGain);
      osc.start(t);
      osc.stop(t + 0.8);
      break;
    }

    case "thud_kick": {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(130 * pitch, t);
      osc.frequency.exponentialRampToValueAtTime(38 * pitch, t + 0.14);
      gain.gain.setValueAtTime(1.0, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(gain);
      gain.connect(padGain);
      osc.start(t);
      osc.stop(t + 0.35);
      break;
    }

    case "noise_drop": {
      const source = ctx.createBufferSource();
      source.buffer = noise;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(Math.min(18000, 3500 * pitch), t);
      filter.frequency.exponentialRampToValueAtTime(Math.max(20, 100 * pitch), t + 0.45);
      filter.Q.setValueAtTime(4.0, t);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.75, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.48);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(padGain);
      source.start(t);
      source.stop(t + 0.5);
      break;
    }

    default:
      break;
  }
}
