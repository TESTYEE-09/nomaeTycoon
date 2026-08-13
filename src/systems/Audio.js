// Lightweight synthesized SFX using WebAudio — no external assets required.
// Swappable: replace `playTone`/`playNoise` calls with sample playback later.

export class AudioSystem {
  constructor(settings) {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.settings = settings || { sfxVol: 0.8, musicVol: 0.6 };
    this.unlocked = false;
    this._musicNodes = null;
  }

  _ensureCtx() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.settings.sfxVol;
    this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.settings.musicVol;
    this.musicGain.connect(this.master);
  }

  unlock() {
    this._ensureCtx();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.unlocked = true;
  }

  setSfxVolume(v) {
    this.settings.sfxVol = v;
    if (this.sfxGain) this.sfxGain.gain.value = v;
  }

  setMusicVolume(v) {
    this.settings.musicVol = v;
    if (this.musicGain) this.musicGain.gain.value = v;
  }

  _tone({ freq = 440, duration = 0.12, type = 'sine', gain = 0.3, slideTo = null, delay = 0 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + duration);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  _chord(freqs, opts = {}) {
    freqs.forEach((f, i) => this._tone({ ...opts, freq: f, delay: (opts.delay || 0) + i * (opts.stagger ?? 0.03) }));
  }

  click() {
    this._ensureCtx();
    const pitch = 520 + Math.random() * 60;
    this._tone({ freq: pitch, duration: 0.09, type: 'triangle', gain: 0.25, slideTo: pitch * 1.4 });
  }

  clickCombo(comboStacks) {
    this._ensureCtx();
    const pitch = 520 + comboStacks * 18;
    this._tone({ freq: pitch, duration: 0.09, type: 'triangle', gain: 0.28, slideTo: pitch * 1.5 });
  }

  coin() {
    this._ensureCtx();
    this._chord([660, 990], { duration: 0.14, type: 'sine', gain: 0.18, stagger: 0.05 });
  }

  purchase() {
    this._ensureCtx();
    this._chord([392, 523, 659], { duration: 0.18, type: 'sine', gain: 0.22, stagger: 0.06 });
  }

  upgrade() {
    this._ensureCtx();
    this._chord([440, 554, 659, 880], { duration: 0.22, type: 'triangle', gain: 0.2, stagger: 0.045 });
  }

  unlockZone() {
    this._ensureCtx();
    this._chord([330, 440, 554, 660, 880], { duration: 0.35, type: 'sawtooth', gain: 0.14, stagger: 0.07 });
  }

  jackpot() {
    this._ensureCtx();
    for (let i = 0; i < 8; i++) {
      this._tone({ freq: 440 + i * 90, duration: 0.2, type: 'square', gain: 0.12, delay: i * 0.05 });
    }
  }

  rebirth() {
    this._ensureCtx();
    this._chord([220, 277, 330, 440, 554, 660, 880, 1108], { duration: 0.6, type: 'sine', gain: 0.16, stagger: 0.09 });
  }

  uiClick() {
    this._ensureCtx();
    this._tone({ freq: 300, duration: 0.05, type: 'square', gain: 0.12 });
  }

  error() {
    this._ensureCtx();
    this._tone({ freq: 180, duration: 0.15, type: 'sawtooth', gain: 0.15, slideTo: 90 });
  }

  quest() {
    this._ensureCtx();
    this._chord([523, 659, 784], { duration: 0.25, type: 'sine', gain: 0.18, stagger: 0.06 });
  }
}
