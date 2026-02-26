const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const DURATION_SECONDS = 18;
const TOTAL_SAMPLES = SAMPLE_RATE * DURATION_SECONDS;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createRng(seed) {
  let state = seed >>> 0;
  return function rng() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function writeMonoWav(filePath, samples) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i += 1) {
    const sample = clamp(samples[i], -1, 1);
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }

  fs.writeFileSync(filePath, buffer);
}

function generateRain() {
  const rng = createRng(11);
  const out = new Float32Array(TOTAL_SAMPLES);
  let hp = 0;
  let prevIn = 0;
  const drops = [];

  for (let i = 0; i < TOTAL_SAMPLES; i += 1) {
    const white = rng() * 2 - 1;
    hp = 0.985 * (hp + white - prevIn);
    prevIn = white;

    if (rng() < 0.0018) {
      drops.push({ amp: 0.25 + rng() * 0.35, phase: 0, freq: 900 + rng() * 1900 });
    }

    let dropSignal = 0;
    for (let d = drops.length - 1; d >= 0; d -= 1) {
      const drop = drops[d];
      const env = Math.exp(-drop.phase * 18);
      dropSignal += Math.sin(2 * Math.PI * drop.freq * drop.phase) * drop.amp * env;
      drop.phase += 1 / SAMPLE_RATE;
      if (env < 0.0008) drops.splice(d, 1);
    }

    out[i] = hp * 0.17 + dropSignal * 0.18;
  }

  return out;
}

function generateWaterfall() {
  const rng = createRng(22);
  const out = new Float32Array(TOTAL_SAMPLES);
  let lp = 0;
  let rumblePhase = 0;

  for (let i = 0; i < TOTAL_SAMPLES; i += 1) {
    const white = rng() * 2 - 1;
    lp = lp + 0.06 * (white - lp);
    const rumble = Math.sin(rumblePhase) * 0.22 + Math.sin(rumblePhase * 0.4) * 0.14;
    rumblePhase += (2 * Math.PI * 42) / SAMPLE_RATE;

    const slow = Math.sin((2 * Math.PI * i) / (SAMPLE_RATE * 8));
    const splash = Math.abs(lp) * (0.6 + slow * 0.2);

    out[i] = lp * 0.35 + rumble * 0.25 + splash * 0.28;
  }

  return out;
}

function generateBirds() {
  const rng = createRng(33);
  const out = new Float32Array(TOTAL_SAMPLES);
  let wind = 0;
  const chirps = [];

  for (let i = 0; i < TOTAL_SAMPLES; i += 1) {
    if (rng() < 0.00035) {
      chirps.push({
        pos: 0,
        length: 0.11 + rng() * 0.15,
        startFreq: 1400 + rng() * 1200,
        sweep: 800 + rng() * 1200,
        amp: 0.12 + rng() * 0.12,
      });
    }

    wind += 0.02 * ((rng() * 2 - 1) - wind);
    let signal = wind * 0.09;

    for (let c = chirps.length - 1; c >= 0; c -= 1) {
      const chirp = chirps[c];
      const t = chirp.pos;
      const env = Math.sin(Math.PI * clamp(t / chirp.length, 0, 1));
      const freq = chirp.startFreq + chirp.sweep * t;
      signal += Math.sin(2 * Math.PI * freq * t) * chirp.amp * env;
      chirp.pos += 1 / SAMPLE_RATE;
      if (chirp.pos >= chirp.length) chirps.splice(c, 1);
    }

    out[i] = signal;
  }

  return out;
}

function generateFrogs() {
  const rng = createRng(44);
  const out = new Float32Array(TOTAL_SAMPLES);
  const frogs = [
    { interval: 1.35, timer: 0, freq: 170, amp: 0.25 },
    { interval: 1.9, timer: 0.4, freq: 145, amp: 0.22 },
  ];
  const croaks = [];

  for (let i = 0; i < TOTAL_SAMPLES; i += 1) {
    const dt = 1 / SAMPLE_RATE;
    for (const frog of frogs) {
      frog.timer += dt;
      if (frog.timer >= frog.interval + (rng() - 0.5) * 0.2) {
        frog.timer = 0;
        croaks.push({ t: 0, dur: 0.22, freq: frog.freq + (rng() - 0.5) * 25, amp: frog.amp });
      }
    }

    let signal = 0;
    for (let c = croaks.length - 1; c >= 0; c -= 1) {
      const croak = croaks[c];
      const x = croak.t / croak.dur;
      const env = x < 1 ? Math.sin(Math.PI * x) : 0;
      const wobble = 1 + Math.sin(2 * Math.PI * 18 * croak.t) * 0.08;
      signal += Math.sin(2 * Math.PI * croak.freq * wobble * croak.t) * croak.amp * env;
      croak.t += dt;
      if (croak.t >= croak.dur) croaks.splice(c, 1);
    }

    signal += (rng() * 2 - 1) * 0.02;
    out[i] = signal;
  }

  return out;
}

const outDir = path.join(__dirname, '..', 'assets', 'sounds');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const files = [
  { name: 'rain.wav', samples: generateRain() },
  { name: 'waterfall.wav', samples: generateWaterfall() },
  { name: 'birds.wav', samples: generateBirds() },
  { name: 'frogs.wav', samples: generateFrogs() },
];

for (const file of files) {
  writeMonoWav(path.join(outDir, file.name), file.samples);
  console.log(`Wrote ${file.name}`);
}
