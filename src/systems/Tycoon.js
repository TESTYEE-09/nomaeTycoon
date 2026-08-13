import * as THREE from 'three';
import { MACHINES } from '../config/balance.js';
import { Pool } from '../utils/pool.js';

const ORB_SPEED = 9;

export class Tycoon {
  constructor(game) {
    this.game = game;
    this.pads = game.world.pads;
    this.visuals = {}; // machineId -> { group, parts, level }
    this.orbTimers = {};
    this.activeOrbs = [];
    this.nearPad = null;

    this.orbPool = new Pool(
      () => {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 8, 6),
          new THREE.MeshBasicMaterial({ color: 0xffe066 })
        );
        mesh.visible = false;
        game.scene.add(mesh);
        return mesh;
      },
      (mesh) => (mesh.visible = false)
    );

    this._rebuildOwnedVisuals();
  }

  _rebuildOwnedVisuals() {
    for (const pad of this.pads) {
      const count = this.game.save.data.machines?.[pad.machine.id]?.count || 0;
      if (count > 0) this._buildMachineVisual(pad, count, false);
    }
  }

  isUnlocked(machineDef) {
    return this.game.save.data.lifetimeGoo >= machineDef.unlockAt;
  }

  cost(machineDef) {
    return this.game.economy.machineCost(machineDef);
  }

  canBuy(machineDef) {
    const count = this.game.economy.machineCount(machineDef.id);
    if (count >= machineDef.maxCount) return false;
    if (!this.isUnlocked(machineDef)) return false;
    return this.game.economy.canAfford(this.cost(machineDef));
  }

  buy(machineId) {
    const machineDef = MACHINES.find((m) => m.id === machineId);
    if (!machineDef || !this.canBuy(machineDef)) {
      this.game.audio.error();
      return false;
    }
    const cost = this.cost(machineDef);
    this.game.economy.spend(cost);
    const s = this.game.save.data;
    if (!s.machines[machineId]) s.machines[machineId] = { count: 0, level: 0 };
    s.machines[machineId].count += 1;
    s.totalPurchases = (s.totalPurchases || 0) + 1;
    this.game.quests.onProgress('buy', 1);
    if (s.machines[machineId].count === 1) this.game.quests.onProgress('machine', 1);

    const pad = this.pads.find((p) => p.machine.id === machineId);
    this._buildMachineVisual(pad, s.machines[machineId].count, true);
    this.game.audio.purchase();
    this.game.particles.burst(pad.position.clone().add(new THREE.Vector3(0, 1, 0)), {
      count: 22,
      color: machineDef.color,
      speed: 5,
      life: 0.9,
    });
    this.game.camera.shake(0.12, 0.2);
    this.game.ui.notify(`Bought ${machineDef.name}!`, 'success');
    this.game.ui.refreshTycoon();
    return true;
  }

  _buildMachineVisual(pad, count, animateIn) {
    let entry = this.visuals[pad.machine.id];
    if (!entry) {
      const group = new THREE.Group();
      group.position.copy(pad.position);
      this.game.scene.add(group);
      entry = { group, mesh: null };
      this.visuals[pad.machine.id] = entry;
    }
    if (entry.mesh) entry.group.remove(entry.mesh);

    const scale = 0.9 + Math.min(1.4, Math.log2(count + 1) * 0.32);
    const color = pad.machine.color;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.35, emissive: color, emissiveIntensity: 0.25 });
    const parts = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 1.1, 8), mat);
    base.position.y = 0.55;
    parts.add(base);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), mat);
    core.position.y = 1.5;
    parts.add(core);
    for (let i = 0; i < 3; i++) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), mat);
      const a = (i / 3) * Math.PI * 2;
      strut.position.set(Math.cos(a) * 0.5, 1.05, Math.sin(a) * 0.5);
      parts.add(strut);
    }
    parts.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    parts.scale.setScalar(scale);
    entry.group.add(parts);
    entry.mesh = parts;
    entry.core = core;
    entry.count = count;

    if (animateIn) {
      parts.position.y = -3;
      parts.scale.setScalar(0.01);
      this._animIn = this._animIn || [];
      this._animIn.push({ obj: parts, targetY: 0, targetScale: scale, t: 0 });
    }
  }

  _spawnOrb(pad) {
    const orb = this.orbPool.acquire();
    orb.visible = true;
    orb.material.color.set(pad.machine.color);
    orb.position.copy(pad.position).add(new THREE.Vector3(0, 1.6, 0));
    const vaultPos = this.game.world.vault.position.clone().add(new THREE.Vector3(0, 1.5, 0));
    this.activeOrbs.push({ mesh: orb, from: orb.position.clone(), to: vaultPos, t: 0, machine: pad.machine });
  }

  update(dt, elapsed) {
    // production ticks -> spawn traveling orbs occasionally per active pad
    for (const pad of this.pads) {
      const count = this.game.economy.machineCount(pad.machine.id);
      if (count <= 0) continue;
      this.orbTimers[pad.machine.id] = (this.orbTimers[pad.machine.id] || Math.random()) - dt;
      if (this.orbTimers[pad.machine.id] <= 0) {
        this.orbTimers[pad.machine.id] = 0.5 + Math.random() * 0.6;
        this._spawnOrb(pad);
      }
      const entry = this.visuals[pad.machine.id];
      if (entry && entry.core) {
        entry.core.rotation.y = elapsed * 1.4;
        entry.core.position.y = 1.5 + Math.sin(elapsed * 3 + pad.position.x) * 0.06;
      }
    }

    for (let i = this.activeOrbs.length - 1; i >= 0; i--) {
      const o = this.activeOrbs[i];
      o.t += dt * ORB_SPEED * 0.12;
      if (o.t >= 1) {
        this.activeOrbs.splice(i, 1);
        this.orbPool.release(o.mesh);
        this.game.world.vault.scale.setScalar(1.08);
        continue;
      }
      o.mesh.position.lerpVectors(o.from, o.to, o.t);
      o.mesh.position.y += Math.sin(o.t * Math.PI) * 1.5;
    }

    if (this._animIn) {
      for (let i = this._animIn.length - 1; i >= 0; i--) {
        const a = this._animIn[i];
        a.t += dt / 0.6;
        const t = Math.min(1, a.t);
        const ease = 1 - Math.pow(1 - t, 3);
        a.obj.position.y = -3 * (1 - ease);
        a.obj.scale.setScalar(a.targetScale * ease);
        if (t >= 1) this._animIn.splice(i, 1);
      }
    }

    if (this.game.world.vault) {
      this.game.world.vault.scale.lerp(new THREE.Vector3(1, 1, 1), 1 - Math.pow(0.001, dt));
    }

    this._updateNearPad();
  }

  _updateNearPad() {
    const p = this.game.player.position;
    let closest = null;
    let bestDist = 2.6;
    for (const pad of this.pads) {
      const d = p.distanceTo(pad.position);
      if (d < bestDist) {
        bestDist = d;
        closest = pad;
      }
    }
    this.nearPad = closest;
    this.game.ui.setPadPrompt(closest);
  }

  tryBuyNear() {
    if (this.nearPad) this.buy(this.nearPad.machine.id);
  }

  clearAllVisuals() {
    for (const id in this.visuals) {
      const entry = this.visuals[id];
      this.game.scene.remove(entry.group);
    }
    this.visuals = {};
    for (const o of this.activeOrbs) this.orbPool.release(o.mesh);
    this.activeOrbs = [];
  }
}
