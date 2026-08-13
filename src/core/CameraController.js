import * as THREE from 'three';
import { clamp, lerp } from '../utils/format.js';

// Third-person orbit-follow camera with smoothing, zoom and juice effects.
export class CameraController {
  constructor(camera, input, target) {
    this.camera = camera;
    this.input = input;
    this.target = target; // object3D to follow
    this.yaw = Math.PI * 0.15;
    this.pitch = 0.55;
    this.distance = 7.5;
    this.minDist = 3.5;
    this.maxDist = 16;
    this.shakeTime = 0;
    this.shakeStrength = 0;
    this.zoomPulse = 0;
    this.desiredPos = new THREE.Vector3();
    this.currentLookAt = new THREE.Vector3();
    this.enableShake = true;
  }

  shake(strength = 0.15, duration = 0.25) {
    if (!this.enableShake) return;
    this.shakeStrength = Math.max(this.shakeStrength, strength);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  punchZoom(amount = 0.4) {
    this.zoomPulse = Math.max(this.zoomPulse, amount);
  }

  update(dt) {
    const drag = this.input.consumeDrag();
    this.yaw -= drag.x * 0.0045;
    this.pitch = clamp(this.pitch - drag.y * 0.003, 0.15, 1.3);
    const wheel = this.input.consumeWheel();
    this.distance = clamp(this.distance + wheel * 0.01, this.minDist, this.maxDist);

    this.zoomPulse = Math.max(0, this.zoomPulse - dt * 1.6);
    const effDist = this.distance - this.zoomPulse;

    const tx = this.target.position.x;
    const ty = this.target.position.y + 1.4;
    const tz = this.target.position.z;

    const ox = Math.sin(this.yaw) * Math.cos(this.pitch) * effDist;
    const oy = Math.sin(this.pitch) * effDist + 1.2;
    const oz = Math.cos(this.yaw) * Math.cos(this.pitch) * effDist;

    this.desiredPos.set(tx + ox, ty + oy, tz + oz);

    let shakeOffset = new THREE.Vector3();
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const s = this.shakeStrength * (this.shakeTime > 0 ? 1 : 0);
      shakeOffset.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
      this.shakeStrength *= 0.9;
    }

    this.camera.position.lerp(this.desiredPos.clone().add(shakeOffset), 1 - Math.pow(0.001, dt));
    this.currentLookAt.lerp(new THREE.Vector3(tx, ty, tz), 1 - Math.pow(0.0005, dt));
    this.camera.lookAt(this.currentLookAt);
  }

  getForwardFlat() {
    // Direction the player should move "forward" relative to camera yaw.
    return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
  }
}
