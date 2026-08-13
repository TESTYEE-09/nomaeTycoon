import { SAVE_KEY, AUTOSAVE_INTERVAL } from '../config/balance.js';

const DEFAULT_SAVE = () => ({
  version: 1,
  goo: 0,
  lifetimeGoo: 0,
  crystals: 0,
  rebirths: 0,
  charUpgrades: {},
  tycoonUpgrades: {},
  machines: {},
  zones: { puddle: true },
  currentZone: 'puddle',
  prestigeUpgrades: {},
  quests: null,
  clickCount: 0,
  totalPurchases: 0,
  luckyCollected: 0,
  settings: { musicVol: 0.6, sfxVol: 0.8, shadows: true, camShake: true },
  lastSeen: Date.now(),
  tutorialStep: 0,
});

export class SaveManager {
  constructor() {
    this.data = this.load();
    this._timer = null;
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return DEFAULT_SAVE();
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SAVE(), ...parsed };
    } catch (e) {
      console.warn('Save corrupted, starting fresh', e);
      return DEFAULT_SAVE();
    }
  }

  save() {
    this.data.lastSeen = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Save failed', e);
    }
  }

  startAutosave(cb) {
    this._timer = setInterval(() => {
      this.save();
      if (cb) cb();
    }, AUTOSAVE_INTERVAL);
  }

  stopAutosave() {
    if (this._timer) clearInterval(this._timer);
  }

  reset() {
    localStorage.removeItem(SAVE_KEY);
    this.data = DEFAULT_SAVE();
  }
}
