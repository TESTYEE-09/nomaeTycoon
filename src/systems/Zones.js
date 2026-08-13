import * as THREE from 'three';
import { ZONES } from '../config/balance.js';

export class ZoneSystem {
  constructor(game) {
    this.game = game;
    this.currentZoneId = game.save.data.currentZone || 'puddle';
    this.lastCheckedZoneId = null;
    // sync visuals for already-unlocked zones from save
    for (const zone of ZONES) {
      if (game.save.data.zones[zone.id]) {
        const gate = game.world.gates[zone.id];
        if (gate) gate.visible = false;
      }
    }

    const startZone = ZONES.find((z) => z.id === this.currentZoneId) || ZONES[0];
    game.scene.background = new THREE.Color(startZone.sky);
    game.scene.fog = new THREE.Fog(startZone.fog, 30, 110);
  }

  isUnlocked(id) {
    return !!this.game.save.data.zones[id];
  }

  canAfford(zone) {
    return this.game.save.data.goo >= zone.cost;
  }

  unlock(zoneId) {
    const zone = ZONES.find((z) => z.id === zoneId);
    if (!zone || this.isUnlocked(zoneId)) return false;
    if (!this.canAfford(zone)) return false;
    this.game.economy.spend(zone.cost);
    this.game.save.data.zones[zoneId] = true;
    this.game.world.unlockZoneVisual(zoneId);
    this.game.audio.unlockZone();
    this.game.camera.shake(0.3, 0.5);
    this.game.ui.notify(`🎉 ${zone.name} unlocked!`, 'success');
    this.game.ui.celebrate();
    this.game.particles.burst(this.game.world.getZoneAnchor(zoneId).clone().add(new THREE.Vector3(0, 2, 0)), {
      count: 40,
      color: zone.color,
      speed: 6,
      life: 1.2,
    });
    this.game.ui.refreshZones();
    return true;
  }

  update() {
    const p = this.game.player.position;
    // determine nearest zone by x position
    let nearest = ZONES[0];
    let bestDist = Infinity;
    for (const z of ZONES) {
      const anchor = this.game.world.getZoneAnchor(z.id);
      const d = Math.abs(p.x - anchor.x);
      if (d < bestDist) {
        bestDist = d;
        nearest = z;
      }
    }
    if (nearest.id !== this.currentZoneId) {
      this.currentZoneId = nearest.id;
      this.game.save.data.currentZone = nearest.id;
      this._applyAtmosphere(nearest);
    }
  }

  _applyAtmosphere(zone) {
    const scene = this.game.scene;
    if (!scene.fog) scene.fog = new THREE.Fog(zone.fog, 30, 110);
    const targetFog = new THREE.Color(zone.fog);
    const targetSky = new THREE.Color(zone.sky);
    this.game._fogTransition = { from: scene.fog.color.clone(), to: targetFog, t: 0 };
    this.game._skyTransition = { from: scene.background ? scene.background.clone() : targetSky.clone(), to: targetSky, t: 0 };
  }
}
