import * as THREE from 'three';
import { PRESTIGE } from '../config/balance.js';
import { costFor } from '../utils/scaling.js';

export class PrestigeSystem {
  constructor(game) {
    this.game = game;
  }

  get save() {
    return this.game.save.data;
  }

  canRebirth() {
    return this.save.lifetimeGoo >= PRESTIGE.unlockAt;
  }

  crystalGain() {
    return PRESTIGE.crystalsFromLifetime(this.save.lifetimeGoo);
  }

  upgradeCost(key) {
    const def = PRESTIGE.upgrades[key];
    const lvl = this.save.prestigeUpgrades?.[key] || 0;
    return costFor(def.baseCost, def.costGrowth, lvl);
  }

  buyUpgrade(key) {
    const def = PRESTIGE.upgrades[key];
    const lvl = this.save.prestigeUpgrades?.[key] || 0;
    if (lvl >= def.max) return false;
    const cost = this.upgradeCost(key);
    if (this.save.crystals < cost) return false;
    this.save.crystals -= cost;
    this.save.prestigeUpgrades[key] = lvl + 1;
    this.game.audio.upgrade();
    this.game.ui.notify(`${def.name} upgraded!`, 'success');
    this.game.ui.refreshPrestige();
    return true;
  }

  doRebirth() {
    if (!this.canRebirth()) return false;
    const gain = this.crystalGain();
    if (gain <= 0) return false;

    this.save.crystals += gain;
    this.save.rebirths += 1;
    this.save.goo = 0;
    this.save.lifetimeGoo = 0;
    this.save.charUpgrades = {};
    this.save.tycoonUpgrades = {};
    this.save.machines = {};
    this.save.zones = { puddle: true };
    this.save.currentZone = 'puddle';

    const startBoostLvl = this.save.prestigeUpgrades?.startBoost || 0;
    const bonus = startBoostLvl * PRESTIGE.upgrades.startBoost.effectPerLevel;
    if (bonus > 0) {
      this.save.goo = bonus;
      this.save.lifetimeGoo = bonus;
    }

    this.game.tycoon.clearAllVisuals();
    this.game.world.relockAllGates();
    this.game.player.position.set(0, 0, 4);
    this.game.player.setGrowth(1, 0, false);

    this.game.camera.shake(0.5, 1.1);
    this.game.camera.punchZoom(1.2);
    this.game.audio.rebirth();
    this.game.particles.burst(this.game.player.position.clone().add(new THREE.Vector3(0, 1.5, 0)), {
      count: 60,
      color: 0xffe066,
      speed: 8,
      life: 1.6,
      spread: 2,
    });
    this.game.ui.playRebirthCinematic(gain);
    this.game.ui.refreshAll();
    return true;
  }
}
