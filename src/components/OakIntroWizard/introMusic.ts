/**
 * Procedural chiptune intro theme for the Oak Intro Wizard.
 * Uses Web Audio API to generate a Pokemon-inspired 8-bit title melody.
 *
 * 4 channels: melody (square), harmony (square), bass (triangle), drums (noise).
 * Stops cleanly when disposed — no overlap with WorldScene game music.
 */

// Note frequencies (octave 3-5)
const NOTE: Record<string, number> = {
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  F3: 174.61,
  G3: 196.0,
  A3: 220.0,
  B3: 246.94,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
  A5: 880.0,
  B5: 987.77,
};

interface NoteEvent {
  freq: number;
  time: number;
  dur: number;
  vol?: number;
}

// ── Melody: Adventurous 8-bit theme (square wave) ──
function getMelody(bpm: number): NoteEvent[] {
  const b = 60 / bpm; // beat duration
  const notes: NoteEvent[] = [];
  let t = 0;

  // Intro pickup (2 beats rest)
  t += b * 2;

  // Phrase 1: Rising adventure motif
  const phrase1: [number, number][] = [
    [NOTE.E4, b * 0.5],
    [NOTE.G4, b * 0.5],
    [NOTE.A4, b],
    [NOTE.B4, b * 0.5],
    [NOTE.A4, b * 0.5],
    [NOTE.G4, b],
    [NOTE.E4, b * 0.5],
    [NOTE.D4, b * 0.5],
    [NOTE.E4, b * 2],
  ];
  for (const [freq, dur] of phrase1) {
    notes.push({ freq, time: t, dur: dur * 0.9 });
    t += dur;
  }

  // Phrase 2: Answer phrase with higher energy
  t += b * 0.5;
  const phrase2: [number, number][] = [
    [NOTE.A4, b * 0.5],
    [NOTE.B4, b * 0.5],
    [NOTE.C5, b],
    [NOTE.D5, b * 0.5],
    [NOTE.C5, b * 0.5],
    [NOTE.B4, b * 0.5],
    [NOTE.A4, b * 0.5],
    [NOTE.G4, b * 2],
  ];
  for (const [freq, dur] of phrase2) {
    notes.push({ freq, time: t, dur: dur * 0.9 });
    t += dur;
  }

  // Phrase 3: Triumphant resolution
  t += b * 0.5;
  const phrase3: [number, number][] = [
    [NOTE.E5, b],
    [NOTE.D5, b * 0.5],
    [NOTE.C5, b * 0.5],
    [NOTE.B4, b],
    [NOTE.A4, b * 0.5],
    [NOTE.G4, b * 0.5],
    [NOTE.A4, b],
    [NOTE.E4, b * 2],
  ];
  for (const [freq, dur] of phrase3) {
    notes.push({ freq, time: t, dur: dur * 0.9 });
    t += dur;
  }

  return notes;
}

// ── Harmony: Supporting chords (square wave, lower volume) ──
function getHarmony(bpm: number): NoteEvent[] {
  const b = 60 / bpm;
  const notes: NoteEvent[] = [];
  let t = 0;

  t += b * 2; // match melody rest

  // Chord hits on downbeats
  const chords: [number, number][] = [
    // Am chord tones
    [NOTE.C4, b * 2],
    [NOTE.E4, b * 2],
    [NOTE.C4, b * 2],
    [NOTE.D4, b * 2],
    // F-G chord tones
    [NOTE.F4, b * 2],
    [NOTE.E4, b * 2],
    [NOTE.D4, b * 2],
    [NOTE.C4, b * 2],
    // Resolve
    [NOTE.E4, b * 2],
    [NOTE.D4, b * 2],
    [NOTE.C4, b * 2],
    [NOTE.E4, b * 2],
  ];

  for (const [freq, dur] of chords) {
    notes.push({ freq, time: t, dur: dur * 0.85, vol: 0.3 });
    t += dur;
  }

  return notes;
}

// ── Bass: Root notes (triangle wave, deep) ──
function getBass(bpm: number): NoteEvent[] {
  const b = 60 / bpm;
  const notes: NoteEvent[] = [];
  let t = 0;

  // Bass starts on beat 1
  const pattern: [number, number][] = [
    [NOTE.A3, b * 2],
    [NOTE.E3, b * 2],
    [NOTE.A3, b * 2],
    [NOTE.G3, b * 2],
    [NOTE.F3, b * 2],
    [NOTE.C3, b * 2],
    [NOTE.G3, b * 2],
    [NOTE.E3, b * 2],
    [NOTE.A3, b * 2],
    [NOTE.G3, b * 2],
    [NOTE.F3, b * 2],
    [NOTE.E3, b * 2],
    [NOTE.A3, b * 4],
  ];

  for (const [freq, dur] of pattern) {
    notes.push({ freq, time: t, dur: dur * 0.9 });
    t += dur;
  }

  return notes;
}

export class IntroMusic {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private scheduledNodes: (OscillatorNode | AudioBufferSourceNode)[] = [];
  private loopTimeout: ReturnType<typeof setTimeout> | null = null;
  private _playing = false;

  get playing(): boolean {
    return this._playing;
  }

  private playNote(
    freq: number,
    startTime: number,
    duration: number,
    volume: number,
    waveType: OscillatorType
  ): void {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = waveType;
    osc.frequency.setValueAtTime(freq, startTime);

    // Warm low-pass filter
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(waveType === "triangle" ? 1200 : 2500, startTime);
    filter.Q.setValueAtTime(0.5, startTime);

    // ADSR envelope
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
    gain.gain.setValueAtTime(volume, startTime + duration * 0.7);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);

    this.scheduledNodes.push(osc);
    osc.onended = () => {
      const idx = this.scheduledNodes.indexOf(osc);
      if (idx !== -1) this.scheduledNodes.splice(idx, 1);
    };
  }

  private playDrum(startTime: number, duration: number, volume: number): void {
    if (!this.ctx || !this.masterGain) return;

    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(800, startTime);

    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    source.start(startTime);
    this.scheduledNodes.push(source);
    source.onended = () => {
      const idx = this.scheduledNodes.indexOf(source);
      if (idx !== -1) this.scheduledNodes.splice(idx, 1);
    };
  }

  private scheduleLoop(): void {
    if (!this.ctx || !this._playing) return;

    const bpm = 132;
    const b = 60 / bpm;
    const now = this.ctx.currentTime + 0.05;

    // Schedule all channels
    for (const note of getMelody(bpm)) {
      this.playNote(note.freq, now + note.time, note.dur, note.vol ?? 0.5, "square");
    }
    for (const note of getHarmony(bpm)) {
      this.playNote(note.freq, now + note.time, note.dur, note.vol ?? 0.3, "square");
    }
    for (const note of getBass(bpm)) {
      this.playNote(note.freq, now + note.time, note.dur, 0.4, "triangle");
    }

    // Simple drum pattern on beats
    const totalBeats = 28;
    for (let i = 0; i < totalBeats; i++) {
      const beatTime = now + i * b;
      if (i % 2 === 0) {
        this.playDrum(beatTime, 0.08, 0.15); // kick on even beats
      }
      if (i % 4 === 2) {
        this.playDrum(beatTime, 0.04, 0.1); // snare on 3
      }
    }

    // Loop duration
    const loopDuration = totalBeats * b;
    this.loopTimeout = setTimeout(
      () => {
        if (this._playing) this.scheduleLoop();
      },
      loopDuration * 1000 - 200
    ); // schedule slightly early for seamless loop
  }

  start(volume = 0.08): void {
    if (this._playing) return;

    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      // Fade in over 0.5s
      this.masterGain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 0.5);
      this.masterGain.connect(this.ctx.destination);

      this._playing = true;
      this.scheduleLoop();
    } catch {
      // AudioContext not available (SSR, etc.)
    }
  }

  stop(): void {
    this._playing = false;

    if (this.loopTimeout) {
      clearTimeout(this.loopTimeout);
      this.loopTimeout = null;
    }

    if (this.masterGain && this.ctx) {
      // Fade out over 0.3s
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0, now + 0.3);

      // Clean up after fade
      setTimeout(() => {
        for (const node of this.scheduledNodes) {
          try {
            node.stop();
          } catch {
            /* already stopped */
          }
        }
        this.scheduledNodes = [];
        this.ctx?.close();
        this.ctx = null;
        this.masterGain = null;
      }, 400);
    }
  }

  /** Play a single sound effect (whoosh, chime, etc.) */
  static playSfx(type: "whoosh" | "chime" | "click"): void {
    try {
      const ctx = new AudioContext();
      const gain = ctx.createGain();
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === "whoosh") {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.3);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === "chime") {
        // Two-note chime (like Pokemon item get)
        for (const [freq, delay] of [
          [659.25, 0],
          [783.99, 0.12],
        ] as const) {
          const osc = ctx.createOscillator();
          osc.type = "square";
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, now + delay);
          g.gain.linearRampToValueAtTime(0.05, now + delay + 0.01);
          g.gain.linearRampToValueAtTime(0, now + delay + 0.3);
          osc.frequency.setValueAtTime(freq, now + delay);
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start(now + delay);
          osc.stop(now + delay + 0.35);
        }
      } else if (type === "click") {
        const osc = ctx.createOscillator();
        osc.type = "square";
        osc.frequency.setValueAtTime(1200, now);
        gain.gain.setValueAtTime(0.03, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.05);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.06);
      }

      // Auto-close context after effects play
      setTimeout(() => ctx.close(), 1000);
    } catch {
      // Silent fail if audio not available
    }
  }
}
