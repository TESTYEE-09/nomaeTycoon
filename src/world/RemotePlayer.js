import * as THREE from 'three';

// A other-player slime. Deliberately lighter than the local Player: no
// squash spring, no accessories — just a bouncing blob, a name tag, and a
// tap ring, interpolated toward whatever the server last said.

const NAME_W = 256;
const NAME_H = 64;

export class RemotePlayer {
  constructor(scene, record) {
    this.id = record.id;
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.position.set(record.x, 0, record.z);

    this.target = new THREE.Vector3(record.x, 0, record.z);
    this.targetFacing = record.f || 0;
    this.targetScale = record.s || 1;
    this.zone = record.zone;
    this.bobT = Math.random() * 6;

    const color = new THREE.Color(record.color ?? 0x53e6a5);
    this.body = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 20, 14),
      new THREE.MeshStandardMaterial({ color, roughness: 0.35, emissive: color.clone().multiplyScalar(0.12), transparent: true, opacity: 0.95 })
    );
    this.body.position.y = 0.59;
    this.body.castShadow = true;
    this.group.add(this.body);

    const eyeGeo = new THREE.SphereGeometry(0.1, 8, 6);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x102018, roughness: 0.4 });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(side * 0.23, 0.75, 0.48);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), pupilMat);
      pupil.position.z = 0.08;
      eye.add(pupil);
      this.group.add(eye);
    }

    this.tag = this._makeNameTag(record.name);
    this.group.add(this.tag);

    this.tapRing = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.85, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide })
    );
    this.tapRing.rotation.x = -Math.PI / 2;
    this.tapRing.position.y = 0.08;
    this.group.add(this.tapRing);
    this._ringT = 1;

    scene.add(this.group);
  }

  _makeNameTag(name) {
    const canvas = document.createElement('canvas');
    canvas.width = NAME_W;
    canvas.height = NAME_H;
    const ctx = canvas.getContext('2d');
    this._nameCanvas = { canvas, ctx };
    this._drawName(name);
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    this._nameTex = tex;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sprite.scale.set(2.1, 0.52, 1);
    sprite.position.y = 1.75;
    sprite.renderOrder = 10;
    return sprite;
  }

  _drawName(name) {
    const { ctx } = this._nameCanvas;
    ctx.clearRect(0, 0, NAME_W, NAME_H);
    ctx.fillStyle = 'rgba(10,6,25,0.6)';
    ctx.beginPath();
    ctx.roundRect(6, 10, NAME_W - 12, NAME_H - 24, 16);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px Baloo 2, Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(name).slice(0, 16), NAME_W / 2, NAME_H / 2 - 2);
  }

  setName(name) {
    this._drawName(name);
    this._nameTex.needsUpdate = true;
  }

  applyPos(msg) {
    this.target.set(msg.x, 0, msg.z);
    this.targetFacing = msg.f;
    this.targetScale = msg.s;
    this.zone = msg.zone;
  }

  tap() {
    this._ringT = 0;
  }

  update(dt) {
    // position: exponential smoothing toward the last known point
    const k = 1 - Math.pow(0.0001, dt);
    this.group.position.x += (this.target.x - this.group.position.x) * k;
    this.group.position.z += (this.target.z - this.group.position.z) * k;

    let diff = this.targetFacing - this.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.group.rotation.y += diff * Math.min(1, dt * 9);

    const moving = this.target.distanceToSquared(this.group.position) > 0.01;
    this.bobT += dt * (moving ? 8 : 2);
    const s = this.targetScale;
    const squash = 1 + Math.sin(this.bobT) * (moving ? 0.07 : 0.02);
    this.body.scale.set(s / Math.sqrt(squash), s * squash, s / Math.sqrt(squash));
    this.group.position.y = moving ? Math.abs(Math.sin(this.bobT)) * 0.07 : 0;
    this.tag.position.y = 1.35 + s * 0.55;

    if (this._ringT < 1) {
      this._ringT = Math.min(1, this._ringT + dt * 1.8);
      this.tapRing.scale.setScalar(0.6 + this._ringT * 2.2);
      this.tapRing.material.opacity = 0.7 * (1 - this._ringT);
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
  }
}
