import * as THREE from 'three';
import { EVENTS } from '../config/balance.js';

function randRange([a, b]) {
  return a + Math.random() * (b - a);
}

export class EventSystem {
  constructor(game) {
    this.game = game;
    this.luckyTimer = randRange(EVENTS.luckyBlobInterval);
    this.goldenTimer = randRange(EVENTS.goldenWindowInterval);
    this.luckyMesh = null;
    this.luckyLight = null;
  }

  update(dt, elapsed) {
    if (!this.luckyMesh) {
      this.luckyTimer -= dt;
      if (this.luckyTimer <= 0) {
        this.luckyTimer = randRange(EVENTS.luckyBlobInterval);
        if (Math.random() < EVENTS.luckyBlobChance * 4) this._spawnLucky();
      }
    } else {
      this.luckyMesh.rotation.y = elapsed * 2;
      this.luckyMesh.rotation.x = Math.sin(elapsed * 3) * 0.3;
      this.luckyMesh.position.y = 1.3 + Math.sin(elapsed * 2.5) * 0.2;
      this.luckyMesh.userData.life -= dt;
      if (this.luckyMesh.userData.life <= 0) this._despawnLucky();
    }

    this.goldenTimer -= dt;
    if (this.goldenTimer <= 0 && !this.game.economy.goldenActive) {
      this.goldenTimer = randRange(EVENTS.goldenWindowInterval);
      if (Math.random() < EVENTS.goldenWindowChance * 4) this._triggerGolden();
    }
  }

  _spawnLucky() {
    const anchor = this.game.world.getZoneAnchor(this.game.zones.currentZoneId);
    const ang = Math.random() * Math.PI * 2;
    const rad = 6 + Math.random() * 18;
    const pos = new THREE.Vector3(anchor.x + Math.cos(ang) * rad, 1.3, Math.sin(ang) * rad);

    const geo = new THREE.IcosahedronGeometry(0.55, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffd54a, emissive: 0xff9900, emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.2 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.userData.life = 14;
    mesh.userData.isLucky = true;
    mesh.castShadow = true;
    this.game.scene.add(mesh);

    const light = new THREE.PointLight(0xffcc55, 2, 8);
    light.position.copy(pos);
    this.game.scene.add(light);

    this.luckyMesh = mesh;
    this.luckyLight = light;
    this.game.ui.notify('✨ A Lucky Drop appeared!', 'lucky');
  }

  _despawnLucky() {
    if (!this.luckyMesh) return;
    this.game.scene.remove(this.luckyMesh);
    this.game.scene.remove(this.luckyLight);
    this.luckyMesh = null;
    this.luckyLight = null;
  }

  collectLucky() {
    if (!this.luckyMesh) return false;
    const base = randRange(EVENTS.luckyBlobRewardRange);
    const scaledBonus = this.game.economy.passiveIncomePerSecond() * 8;
    const reward = Math.max(base, scaledBonus) * this.game.economy.totalMultiplier();
    this.game.economy.addGoo(reward, 'lucky');
    this.game.save.data.luckyCollected = (this.game.save.data.luckyCollected || 0) + 1;
    this.game.quests.onProgress('lucky', 1);
    this.game.audio.jackpot();
    this.game.camera.shake(0.25, 0.4);
    this.game.camera.punchZoom(0.6);
    this.game.particles.burst(this.luckyMesh.position.clone(), { count: 34, color: 0xffd54a, speed: 6, life: 1.1 });
    this.game.ui.spawnFloatingText(this.luckyMesh.position.clone().add(new THREE.Vector3(0, 1, 0)), `+${Math.round(reward)}`, { color: '#FFD54A', big: true });
    this.game.ui.notify(`Lucky Drop: +${Math.round(reward)} Goo!`, 'lucky');
    this._despawnLucky();
    return true;
  }

  _triggerGolden() {
    this.game.economy.goldenActive = true;
    this.game.economy.goldenTimer = EVENTS.goldenWindowDuration;
    this.game.audio.jackpot();
    this.game.ui.notify('🌟 GOLDEN RUSH! 2x Goo for 15s!', 'golden');
    this.game.ui.setGoldenActive(true, EVENTS.goldenWindowDuration);
  }

  getRaycastTargets() {
    return this.luckyMesh ? [this.luckyMesh] : [];
  }
}
