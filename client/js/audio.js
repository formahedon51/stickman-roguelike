let ctx = null;
let master = null;
let muted = false;

function init() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.4;
    master.connect(ctx.destination);
  } catch (e) { /* noop */ }
}

function tone(freq, dur, type, vol, freqEnd) {
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    if (freqEnd) {
      o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), ctx.currentTime + dur);
    }
    g.gain.value = vol || 0.06;
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(ctx.currentTime + dur);
  } catch (e) { /* noop */ }
}

const SFX = {
  jump: () => tone(300, 0.1, 'square', 0.035, 500),
  dash: () => tone(600, 0.13, 'sawtooth', 0.045, 200),
  attack: () => tone(200, 0.08, 'square', 0.04, 100),
  shoot: () => tone(800, 0.08, 'sine', 0.035, 600),
  hurt: () => tone(120, 0.22, 'sawtooth', 0.09, 60),
  downed: () => tone(80, 0.5, 'sine', 0.1, 40),
  revive: () => tone(500, 0.25, 'sine', 0.05, 800),
  boss: () => {
    tone(60, 0.7, 'sawtooth', 0.13, 40);
    setTimeout(() => tone(50, 0.5, 'sawtooth', 0.1, 30), 200);
  },
  bossDie: () => {
    tone(100, 0.6, 'sawtooth', 0.13, 30);
    setTimeout(() => tone(80, 0.8, 'sine', 0.13, 20), 250);
  },
  wave: () => {
    tone(400, 0.15, 'sine', 0.05, 600);
    setTimeout(() => tone(600, 0.2, 'sine', 0.05, 800), 120);
  },
  coin: () => tone(1200, 0.06, 'sine', 0.025, 1500),
  level: () => {
    tone(500, 0.12, 'sine', 0.05, 700);
    setTimeout(() => tone(750, 0.18, 'sine', 0.05, 900), 100);
  },
};

export function createAudio() {
  document.addEventListener('pointerdown', init, { once: true });
  document.addEventListener('keydown', init, { once: true });

  return {
    sfx: SFX,
    get muted() { return muted; },
    setMuted(v) {
      muted = !!v;
      if (master) master.gain.value = muted ? 0 : 0.4;
      return muted;
    },
    toggle() {
      return this.setMuted(!muted);
    },
  };
}
