// Battle Sound Effects — Web Audio API (zero external audio files)
// Pokemon Crystal-inspired blips, hits, and tones

let audioCtx: AudioContext | null = null;
let audioReady = false;

/** Call once from a user-gesture handler (click/keydown) to ensure AudioContext is active */
export function ensureAudioReady(): void {
  if (audioReady) return;
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") {
    ctx
      .resume()
      .then(() => {
        audioReady = true;
      })
      .catch(() => {});
  } else if (ctx) {
    audioReady = true;
  }
}

function getCtx(): AudioContext | null {
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  // Resume if suspended (browser autoplay policy)
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = "square",
  vol = 0.08
): void {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = vol;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration / 1000);
}

function playNoise(duration: number, vol = 0.06): void {
  const ctx = getCtx();
  if (!ctx) return;
  const bufferSize = ctx.sampleRate * (duration / 1000);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}

function playSlide(startFreq: number, endFreq: number, duration: number, vol = 0.08): void {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = startFreq;
  osc.frequency.linearRampToValueAtTime(endFreq, ctx.currentTime + duration / 1000);
  gain.gain.value = vol;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration / 1000);
}

// === PUBLIC API ===

/** Typewriter character blip — very short, quiet */
export function typewriterBlip(): void {
  playTone(440, 30, "square", 0.03);
}

/** Menu cursor movement */
export function menuBlip(): void {
  playTone(880, 30, "square", 0.06);
}

/** Menu select — two ascending tones */
export function menuSelect(): void {
  playTone(440, 50, "square", 0.07);
  setTimeout(() => playTone(660, 50, "square", 0.07), 60);
}

/** Attack hit — noise burst (thwack) */
export function attackHit(): void {
  playNoise(100, 0.1);
}

/** HP drain — descending tone */
export function hpDrainSound(durationMs = 500): void {
  playSlide(330, 110, durationMs, 0.04);
}

/** Stat raise — C-E-G ascending */
export function statUpSound(): void {
  playTone(262, 80, "square", 0.06); // C
  setTimeout(() => playTone(330, 80, "square", 0.06), 90); // E
  setTimeout(() => playTone(392, 80, "square", 0.06), 180); // G
}

/** Stat lower — G-E-C descending */
export function statDownSound(): void {
  playTone(392, 80, "square", 0.06); // G
  setTimeout(() => playTone(330, 80, "square", 0.06), 90); // E
  setTimeout(() => playTone(262, 80, "square", 0.06), 180); // C
}

/** Faint — long descending slide */
export function faintSound(): void {
  playSlide(440, 110, 500, 0.08);
}

/** Battle start whoosh */
export function battleStartSound(): void {
  playSlide(220, 880, 200, 0.06);
  setTimeout(() => playSlide(880, 440, 200, 0.06), 200);
}

/** Victory fanfare — ascending arpeggio */
export function victoryFanfare(): void {
  const notes = [262, 330, 392, 523, 659, 784]; // C major scale up
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 120, "square", 0.07), i * 100);
  });
}

/** Flee success — quick ascending */
export function fleeSound(): void {
  playSlide(330, 660, 200, 0.06);
}

/** Flee fail — descending bloop */
export function fleeFailSound(): void {
  playSlide(440, 220, 200, 0.06);
}

/** XP gain ding */
export function xpDing(): void {
  playTone(880, 60, "sine", 0.08);
  setTimeout(() => playTone(1100, 100, "sine", 0.08), 70);
}

/** Level up fanfare */
export function levelUpSound(): void {
  const notes = [523, 659, 784, 1047]; // C5-E5-G5-C6
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 150, "square", 0.08), i * 120);
  });
}
