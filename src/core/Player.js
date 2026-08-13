import * as THREE from 'three';

const BASE_RADIUS = 0.62;

// The player character: a bouncy, expressive slime blob that visibly
// grows/glows/accessorizes as the player progresses.
export class Player {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.position.set(0, 0, 4);

    this.bodyGeo = new THREE.SphereGeometry(BASE_RADIUS, 24, 18);
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0x53e6a5,
      roughness: 0.35,
      metalness: 0.05,
      emissive: 0x0c3322,
      emissiveIntensity: 0.25,
    });
    this.body = new THREE.Mesh(this.bodyGeo, this.bodyMat);
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.body.position.y = BASE_RADIUS * 0.95;
    this.group.add(this.body);

    // eyes
    const eyeGeo = new THREE.SphereGeometry(0.11, 10, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const pupilGeo = new THREE.SphereGeometry(0.055, 8, 6);
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x102018, roughness: 0.4 });
    this.eyes = new THREE.Group();
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(side * 0.24, BASE_RADIUS * 1.2, 0.5);
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(0, 0, 0.09);
      eye.add(pupil);
      this.eyes.add(eye);
    }
    this.group.add(this.eyes);

    // glow ring (appears with progression)
    const ringGeo = new THREE.TorusGeometry(BASE_RADIUS * 1.35, 0.035, 8, 32);
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0 });
    this.ring = new THREE.Mesh(ringGeo, this.ringMat);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = 0.05;
    this.group.add(this.ring);

    // crown (rebirth accessory)
    this.crown = new THREE.Group();
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd54a, metalness: 0.7, roughness: 0.25, emissive: 0x664400, emissiveIntensity: 0.3 });
    const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.14, 8), crownMat);
    this.crown.add(crownBase);
    for (let i = 0; i < 5; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 4), crownMat);
      const a = (i / 5) * Math.PI * 2;
      spike.position.set(Math.cos(a) * 0.26, 0.15, Math.sin(a) * 0.26);
      this.crown.add(spike);
    }
    this.crown.visible = false;
    this.crown.position.y = BASE_RADIUS * 1.85;
    this.group.add(this.crown);

    scene.add(this.group);

    this.velocity = new THREE.Vector3();
    this.facing = 0;
    this.squash = 1;
    this.squashVel = 0;
    this.bobT = Math.random() * 10;
    this.baseScale = 1;
    this.moveSpeed = 4.2;
    this.trailTimer = 0;
    this.isMoving = false;
  }

  setGrowth(scaleMult, glowIntensity, hasCrown) {
    this.baseScale = scaleMult;
    this.bodyMat.emissiveIntensity = 0.15 + glowIntensity * 0.6;
    this.ringMat.opacity = Math.min(0.85, glowIntensity * 0.5);
    this.crown.visible = hasCrown;
  }

  setColor(hex) {
    this.bodyMat.color.set(hex);
  }

  tapPulse() {
    this.squashVel -= 3.2;
  }

  jumpHint() {
    this.squashVel += 2.4;
  }

  update(dt, moveInput, cameraForward) {
    const speedMult = this.baseScale > 1 ? 1 + (this.baseScale - 1) * 0.15 : 1;
    const speed = this.moveSpeed * speedMult;
    const mx = moveInput.x;
    const mz = moveInput.z;
    const intent = Math.min(1, Math.hypot(mx, mz));
    this.isMoving = intent > 0.05;

    if (this.isMoving) {
      // camera-relative: forward = into the scene, right = 90deg clockwise of it
      const fx = cameraForward.x;
      const fz = cameraForward.z;
      const rx = -fz;
      const rz = fx;
      const dirX = fx * mz + rx * mx;
      const dirZ = fz * mz + rz * mx;
      const len = Math.hypot(dirX, dirZ) || 1;
      const nx = dirX / len;
      const nz = dirZ / len;
      this.group.position.x += nx * speed * intent * dt;
      this.group.position.z += nz * speed * intent * dt;
      const targetFacing = Math.atan2(nx, nz);
      let diff = targetFacing - this.facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.facing += diff * Math.min(1, dt * 10);
    }

    // clamp to a generous play area
    this.group.position.x = Math.max(-38, Math.min(38, this.group.position.x));
    this.group.position.z = Math.max(-38, Math.min(38, this.group.position.z));
    this.group.rotation.y = this.facing;

    // spring squash & stretch (idle jiggle + movement bounce)
    const springK = 90;
    const springD = 9;
    this.squashVel += (-this.squashVel * springD - (this.squash - 1) * springK) * dt;
    this.squash += this.squashVel * dt;

    this.bobT += dt * (this.isMoving ? 9 : 2.2);
    const bob = this.isMoving ? Math.abs(Math.sin(this.bobT)) * 0.08 : Math.sin(this.bobT) * 0.02;

    const sx = this.baseScale * (1 / Math.sqrt(this.squash));
    const sy = this.baseScale * this.squash;
    this.body.scale.set(sx, sy, sx);
    this.group.position.y = bob;

  }

  get position() {
    return this.group.position;
  }
}
