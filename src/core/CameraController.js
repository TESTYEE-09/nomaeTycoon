import * as THREE from 'three';
import { clamp } from '../utils/format.js';

// Third-person orbit-follow camera.
// Look input is smoothed toward a target yaw/pitch so drags feel weighty
// instead of snapping, and the camera frames the player from slightly above.
export class CameraController {
  constructor(camera, input, target) {
    this.camera = camera;
    this.input = input;
    this.target = target;

    this.yaw = Math.PI * 0.15;
    this.pitch = 0.5;
    this.targetYaw = this.yaw;
    this.targetPitch = this.pitch;

    this.distance = 8.5;
    this.targetDistance = this.distance;
    this.minDist = 4;
    this.maxDist = 18;

    this.minPitch = 0.12;
    this.maxPitch = 1.15;

    this.shakeTime = 0;
    this.shakeStrength = 0;
    this.zoomPulse = 0;
    this.enableShake = true;

    this.desiredPos = new THREE.Vector3();
    this.currentLookAt = new THREE.Vector3(target.position.x, target.position.y + 1.3, target.position.z);
    this._shakeOffset = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
  }

  shake(strength = 0.15, duration = 0.25) {
    if (!this.enableShake) return;
    this.shakeStrength = Math.max(this.shakeStrength, strength);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  punchZoom(amount = 0.4) {
    this.zoomPulse = Math.max(this.zoomPulse, amount);
  }

  /** Snap instantly behind the player (used on zone travel / rebirth). */
  snap() {
    this._place(1);
  }

  update(dt) {
    const look = this.input.consumeLook();
    this.targetYaw -= look.x * 0.005;
    this.targetPitch = clamp(this.targetPitch - look.y * 0.0035, this.minPitch, this.maxPitch);

    // keyboard camera nudge (E is reserved for interact)
    if (this.input.isDown('KeyQ')) this.targetYaw += dt * 1.8;
    if (this.input.isDown('KeyR')) this.targetYaw -= dt * 1.8;

    const wheel = this.input.consumeWheel();
    this.targetDistance = clamp(this.targetDistance + wheel * 0.012, this.minDist, this.maxDist);

    const k = 1 - Math.pow(0.0001, dt);
    this.yaw += (this.targetYaw - this.yaw) * k;
    this.pitch += (this.targetPitch - this.pitch) * k;
    this.distance += (this.targetDistance - this.distance) * k;

    this.zoomPulse = Math.max(0, this.zoomPulse - dt * 1.6);
    this._place(1 - Math.pow(0.0008, dt));
  }

  _place(blend) {
    const effDist = this.distance - this.zoomPulse;
    const tx = this.target.position.x;
    const ty = this.target.position.y + 1.3;
    const tz = this.target.position.z;

    const ox = Math.sin(this.yaw) * Math.cos(this.pitch) * effDist;
    const oy = Math.sin(this.pitch) * effDist + 0.9;
    const oz = Math.cos(this.yaw) * Math.cos(this.pitch) * effDist;
    this.desiredPos.set(tx + ox, ty + oy, tz + oz);

    this._shakeOffset.set(0, 0, 0);
    if (this.shakeTime > 0) {
      this.shakeTime -= 1 / 60;
      const s = this.shakeStrength;
      this._shakeOffset.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
      this.shakeStrength *= 0.9;
    }

    this.camera.position.lerp(this._tmp.copy(this.desiredPos).add(this._shakeOffset), blend);
    this.currentLookAt.lerp(this._tmp.set(tx, ty, tz), Math.min(1, blend * 1.4));
    this.camera.lookAt(this.currentLookAt);
  }

  /** Flat unit vector pointing away from the camera, into the scene. */
  getForwardFlat() {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
  }
}
