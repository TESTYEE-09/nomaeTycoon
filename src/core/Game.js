import * as THREE from 'three';
import { SaveManager } from '../systems/SaveManager.js';
import { AudioSystem } from '../systems/Audio.js';
import { ParticleSystem } from '../systems/Particles.js';
import { Economy } from '../systems/Economy.js';
import { Tycoon } from '../systems/Tycoon.js';
import { ZoneSystem } from '../systems/Zones.js';
import { QuestSystem } from '../systems/Quests.js';
import { PrestigeSystem } from '../systems/Prestige.js';
import { EventSystem } from '../systems/Events.js';
import { Multiplayer } from '../systems/Multiplayer.js';
import { World } from '../world/World.js';
import { Player } from './Player.js';
import { Input } from './Input.js';
import { CameraController } from './CameraController.js';
import { UIManager } from '../ui/UIManager.js';
import { OFFLINE_CAP_BASE_HOURS, CHAR_UPGRADES } from '../config/balance.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();
    this.elapsed = 0;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xaef1e0);

    this.rendererCamera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 260);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.save = new SaveManager();
    this.audio = new AudioSystem(this.save.data.settings);
    this.audio.setSfxVolume(this.save.data.settings.sfxVol);
    this.audio.setMusicVolume(this.save.data.settings.musicVol);

    this.world = new World(this.scene);
    this.player = new Player(this.scene);
    const startAnchor = this.world.getZoneAnchor(this.save.data.currentZone || 'puddle');
    this.player.position.set(startAnchor.x, 0, 4);

    this.input = new Input(canvas, {
      onTap: (x, y) => this._handleWorldClick(x, y),
      joystickEl: document.getElementById('joystick'),
    });
    this.input.lookSensitivity = this.save.data.settings.lookSens ?? 1;
    this.input.invertY = !!this.save.data.settings.invertY;
    this.camera = new CameraController(this.rendererCamera, this.input, this.player.group);
    this.camera.enableShake = this.save.data.settings.camShake;

    this.particles = new ParticleSystem(this.scene);
    this.economy = new Economy(this);
    this.zones = new ZoneSystem(this);
    this.tycoon = new Tycoon(this);
    this.quests = new QuestSystem(this);
    this.prestige = new PrestigeSystem(this);
    this.events = new EventSystem(this);

    this.raycaster = new THREE.Raycaster();
    this._pointerNDC = new THREE.Vector2();

    this.ui = new UIManager(this);
    this.multiplayer = new Multiplayer(this);
    this.setShadowsEnabled(this.save.data.settings.shadows);

    this._applyMoveSpeed();
    this._handleOfflineEarnings();

    window.addEventListener('resize', () => this._onResize());

    this.save.startAutosave();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _applyMoveSpeed() {
    const lvl = this.save.data.charUpgrades?.moveSpeed || 0;
    this.player.moveSpeed = 4.2 * (1 + lvl * CHAR_UPGRADES.moveSpeed.effectPerLevel);
  }

  setShadowsEnabled(enabled) {
    this.renderer.shadowMap.enabled = enabled;
    if (this.world.sun) this.world.sun.castShadow = enabled;
  }

  _onResize() {
    this.rendererCamera.aspect = window.innerWidth / window.innerHeight;
    this.rendererCamera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  _handleWorldClick(x, y) {
    this._pointerNDC.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(this._pointerNDC, this.rendererCamera);

    const luckyTargets = this.events.getRaycastTargets();
    if (luckyTargets.length) {
      const hits = this.raycaster.intersectObjects(luckyTargets, false);
      if (hits.length) {
        this.events.collectLucky();
        return;
      }
    }

    if (this.world.gooBlob) {
      const hits = this.raycaster.intersectObject(this.world.gooBlob.blob, false);
      if (hits.length) {
        this.performTap(hits[0].point);
        return;
      }
    }
  }

  performTap(worldPoint) {
    const value = this.economy.registerClick();
    this.multiplayer.sendTap();
    this.world.popGooBlob();
    this.player.tapPulse();
    this.audio.clickCombo(this.economy.comboStacks);
    this.camera.punchZoom(0.12);
    if (this.economy.comboStacks > 4) this.camera.shake(0.04, 0.08);

    const pt = worldPoint || this.world.gooBlob.group.position.clone().add(new THREE.Vector3(0, 2.2, 0));
    this.particles.burst(pt, { count: 8 + Math.min(20, this.economy.comboStacks), color: 0x54ffb0, speed: 3.5, life: 0.6 });
    this.ui.spawnFloatingText(pt.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.4, 0)), '+' + Math.round(value), {
      color: this.economy.comboStacks > 8 ? '#FFD54A' : '#7CFFB2',
      big: this.economy.comboStacks > 8,
    });
    this.ui.el.tapBtn.classList.remove('tapped');
    void this.ui.el.tapBtn.offsetWidth;
    this.ui.el.tapBtn.classList.add('tapped');
  }

  travelTo(zoneId) {
    const anchor = this.world.getZoneAnchor(zoneId);
    this.player.position.set(anchor.x, 0, 4);
    this.particles.burst(this.player.position.clone().add(new THREE.Vector3(0, 1, 0)), { count: 20, color: 0x8f6bff, speed: 5, life: 0.7 });
    this.camera.punchZoom(0.5);
    this.camera.snap();
  }

  _handleOfflineEarnings() {
    const last = this.save.data.lastSeen || Date.now();
    const deltaSec = Math.max(0, (Date.now() - last) / 1000);
    if (deltaSec < 30) return;
    const capLvl = this.save.data.charUpgrades?.capacity || 0;
    const capHours = OFFLINE_CAP_BASE_HOURS + capLvl * CHAR_UPGRADES.capacity.effectPerLevel;
    const cappedSec = Math.min(deltaSec, capHours * 3600);
    const income = this.economy.passiveIncomePerSecond() * cappedSec * 0.6;
    if (income > 1) {
      this.economy.addGoo(income, 'offline');
      setTimeout(() => this.ui.notify(`Welcome back! +${Math.round(income)} Goo earned while away.`, 'success'), 800);
    }
  }

  _loop() {
    requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.elapsed += dt;

    const move = this.input.moveVector();
    this.player.update(dt, move, this.camera.getForwardFlat());
    this.camera.update(dt);

    this.world.update(dt, this.elapsed);
    this.economy.update(dt);
    this.tycoon.update(dt, this.elapsed);
    this.zones.update();
    this.events.update(dt, this.elapsed);
    this.multiplayer.update(dt);
    this.particles.update(dt);

    if (this._fogTransition) {
      const ft = this._fogTransition;
      ft.t = Math.min(1, ft.t + dt * 0.8);
      this.scene.fog.color.lerpColors(ft.from, ft.to, ft.t);
      if (ft.t >= 1) this._fogTransition = null;
    }
    if (this._skyTransition) {
      const st = this._skyTransition;
      st.t = Math.min(1, st.t + dt * 0.8);
      if (!this.scene.background || !this.scene.background.isColor) this.scene.background = st.from.clone();
      this.scene.background.lerpColors(st.from, st.to, st.t);
      if (st.t >= 1) this._skyTransition = null;
    }

    this.ui.update(dt);

    this.renderer.render(this.scene, this.rendererCamera);
  }
}
