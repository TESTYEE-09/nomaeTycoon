import * as THREE from 'three';
import { ZONES, MACHINES } from '../config/balance.js';

const ZONE_SPACING = 95;
const ZONE_RADIUS = 40;

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.zoneAnchors = {};
    this.gates = {};
    this.pads = [];
    this.animated = [];
    this.gooBlob = null;
    this.vault = null;
    this._build();
  }

  getZoneAnchor(id) {
    return this.zoneAnchors[id] || new THREE.Vector3();
  }

  _build() {
    this._buildLighting();
    ZONES.forEach((zone, i) => this._buildZone(zone, i));
    this._buildTycoonPads();
    this._buildGooBlob();
    this._buildPaths();
  }

  _buildLighting() {
    const hemi = new THREE.HemisphereLight(0xbdf3ff, 0x3a2e55, 0.9);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.15);
    sun.position.set(18, 26, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    sun.shadow.camera.far = 90;
    sun.shadow.bias = -0.0025;
    this.scene.add(sun);
    this.sun = sun;
    const fill = new THREE.DirectionalLight(0x88aaff, 0.25);
    fill.position.set(-15, 10, -10);
    this.scene.add(fill);
  }

  _buildZone(zone, index) {
    const cx = index * ZONE_SPACING;
    const anchor = new THREE.Vector3(cx, 0, 0);
    this.zoneAnchors[zone.id] = anchor;

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(ZONE_RADIUS, 48),
      new THREE.MeshStandardMaterial({ color: zone.color, roughness: 0.9, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(cx, 0, 0);
    ground.receiveShadow = true;
    this.scene.add(ground);

    // decorative ring border
    const border = new THREE.Mesh(
      new THREE.TorusGeometry(ZONE_RADIUS, 0.4, 8, 64),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(zone.color).multiplyScalar(0.7), roughness: 0.6 })
    );
    border.rotation.x = Math.PI / 2;
    border.position.set(cx, 0.05, 0);
    this.scene.add(border);

    this._scatterProps(zone, cx, index);

    if (index > 0) {
      this._buildGate(zone, cx);
    }
  }

  _scatterProps(zone, cx, index) {
    const rand = mulberry32(index * 7919 + 13);
    const propCount = 26;
    let geo, mat, yOff = 0, spin = false, bob = false;

    switch (zone.id) {
      case 'puddle':
        geo = new THREE.ConeGeometry(0.9, 2.2, 6);
        mat = new THREE.MeshStandardMaterial({ color: 0x3fbf83, roughness: 0.8 });
        yOff = 1.1;
        break;
      case 'sewers':
        geo = new THREE.CylinderGeometry(0.5, 0.6, 2.6, 6);
        mat = new THREE.MeshStandardMaterial({ color: 0x9b6bff, emissive: 0x4b1fae, emissiveIntensity: 0.6, roughness: 0.4 });
        yOff = 1.3;
        spin = true;
        break;
      case 'caverns':
        geo = new THREE.OctahedronGeometry(1.1, 0);
        mat = new THREE.MeshStandardMaterial({ color: 0x8fe9ff, emissive: 0x1c6c8f, emissiveIntensity: 0.7, roughness: 0.2, metalness: 0.3 });
        yOff = 1.1;
        bob = true;
        break;
      case 'tundra':
        geo = new THREE.ConeGeometry(0.7, 2.4, 5);
        mat = new THREE.MeshStandardMaterial({ color: 0xeaf7ff, roughness: 0.3, metalness: 0.1 });
        yOff = 1.2;
        break;
      case 'magma':
        geo = new THREE.DodecahedronGeometry(1, 0);
        mat = new THREE.MeshStandardMaterial({ color: 0x2b0f08, emissive: 0xff5722, emissiveIntensity: 1.1, roughness: 0.7 });
        yOff = 1;
        bob = true;
        break;
      case 'void':
        geo = new THREE.TetrahedronGeometry(1, 0);
        mat = new THREE.MeshStandardMaterial({ color: 0x120026, emissive: 0xff2fd4, emissiveIntensity: 1.3, roughness: 0.4 });
        yOff = 1.3;
        spin = true;
        bob = true;
        break;
      default:
        geo = new THREE.ConeGeometry(0.9, 2, 6);
        mat = new THREE.MeshStandardMaterial({ color: 0x3fbf83 });
    }

    const inst = new THREE.InstancedMesh(geo, mat, propCount);
    inst.castShadow = true;
    inst.receiveShadow = true;
    const dummy = new THREE.Object3D();
    const bobData = [];
    for (let i = 0; i < propCount; i++) {
      const ang = rand() * Math.PI * 2;
      const rad = 8 + rand() * (ZONE_RADIUS - 10);
      const x = cx + Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad;
      const s = 0.6 + rand() * 0.9;
      dummy.position.set(x, yOff * s, z);
      dummy.rotation.y = rand() * Math.PI * 2;
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      bobData.push({ x, z, s, phase: rand() * Math.PI * 2, yOff });
    }
    inst.instanceMatrix.needsUpdate = true;
    this.scene.add(inst);

    if (spin || bob) {
      this.animated.push({ type: 'propInstance', mesh: inst, data: bobData, spin, bob, dummy: new THREE.Object3D() });
    }
  }

  _buildGate(zone, cx) {
    const gateX = cx - ZONE_SPACING / 2;
    const group = new THREE.Group();
    group.position.set(gateX, 0, 0);

    const barMat = new THREE.MeshStandardMaterial({ color: 0x2a2a3a, roughness: 0.5, metalness: 0.4 });
    for (let i = -3; i <= 3; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 8), barMat);
      bar.position.set(0, 3, i * 1.3);
      bar.castShadow = true;
      group.add(bar);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 9), barMat);
    lintel.position.set(0, 6, 0);
    group.add(lintel);

    // floating sign (DOM-free: use a simple plane with canvas texture)
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(10,10,20,0.85)';
    ctx.fillRect(0, 0, 512, 160);
    ctx.strokeStyle = '#ffd54a';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 504, 152);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(zone.name, 256, 65);
    ctx.fillStyle = '#ffd54a';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('LOCKED', 256, 115);
    const tex = new THREE.CanvasTexture(canvas);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 1.4), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    sign.position.set(0, 7.4, 0);
    group.add(sign);
    group.userData.sign = { canvas, ctx, tex, zone };

    this.scene.add(group);
    this.gates[zone.id] = group;
  }

  relockAllGates() {
    for (const id in this.gates) {
      const gate = this.gates[id];
      gate.visible = true;
      gate.position.y = 0;
      gate.rotation.z = 0;
      gate.scale.setScalar(1);
    }
    this.animated = this.animated.filter((a) => a.type !== 'gateOpen');
  }

  unlockZoneVisual(zoneId) {
    const gate = this.gates[zoneId];
    if (!gate) return;
    this.animated.push({ type: 'gateOpen', mesh: gate, t: 0 });
  }

  _buildTycoonPads() {
    // Grid of purchase pads in the Puddle Park zone.
    const base = this.zoneAnchors['puddle'];
    const cols = 3;
    const spacing = 6.5;
    MACHINES.forEach((m, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = base.x - 14 + col * spacing;
      const z = 10 + row * spacing;
      const padGeo = new THREE.CylinderGeometry(1.6, 1.7, 0.25, 24);
      const padMat = new THREE.MeshStandardMaterial({ color: 0x2f2f3f, roughness: 0.6, emissive: 0x111111 });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(x, 0.13, z);
      pad.receiveShadow = true;
      this.scene.add(pad);

      const ringGeo = new THREE.RingGeometry(1.65, 1.85, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: m.color, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.27, z);
      this.scene.add(ring);

      this.pads.push({ machine: m, position: new THREE.Vector3(x, 0, z), pad, ring, slotGroup: null });
      this.animated.push({ type: 'padPulse', mesh: ring, phase: i * 0.5 });
    });
  }

  _buildGooBlob() {
    const base = this.zoneAnchors['puddle'];
    const group = new THREE.Group();
    group.position.set(base.x, 0, -8);

    const blobGeo = new THREE.SphereGeometry(1.6, 24, 18);
    const blobMat = new THREE.MeshStandardMaterial({ color: 0x54ffb0, emissive: 0x1c8a55, emissiveIntensity: 0.45, roughness: 0.25, transparent: true, opacity: 0.92 });
    const blob = new THREE.Mesh(blobGeo, blobMat);
    blob.position.y = 1.6;
    blob.castShadow = true;
    group.add(blob);

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, 0.5, 20), new THREE.MeshStandardMaterial({ color: 0x2a5d46, roughness: 0.8 }));
    pedestal.position.y = 0.25;
    pedestal.receiveShadow = true;
    group.add(pedestal);

    this.scene.add(group);
    this.gooBlob = { group, blob, baseScale: 1, squash: 1, squashVel: 0 };

    // vault visual near tycoon grid, collects value
    const vaultGroup = new THREE.Group();
    vaultGroup.position.set(base.x, 0, 22);
    const vaultBody = new THREE.Mesh(
      new THREE.BoxGeometry(3, 3, 3),
      new THREE.MeshStandardMaterial({ color: 0xffd54a, metalness: 0.6, roughness: 0.3, emissive: 0x554400, emissiveIntensity: 0.3 })
    );
    vaultBody.position.y = 1.5;
    vaultBody.castShadow = true;
    vaultGroup.add(vaultBody);
    this.scene.add(vaultGroup);
    this.vault = vaultGroup;
  }

  _buildPaths() {
    const pathMat = new THREE.MeshStandardMaterial({ color: 0xffffff, opacity: 0.35, transparent: true, roughness: 1 });
    for (let i = 0; i < ZONES.length - 1; i++) {
      const x1 = i * ZONE_SPACING + ZONE_RADIUS - 2;
      const x2 = (i + 1) * ZONE_SPACING - ZONE_RADIUS + 2;
      const len = x2 - x1;
      const path = new THREE.Mesh(new THREE.PlaneGeometry(len, 4), pathMat);
      path.rotation.x = -Math.PI / 2;
      path.position.set((x1 + x2) / 2, 0.02, 0);
      this.scene.add(path);
    }
  }

  update(dt, elapsed) {
    for (const a of this.animated) {
      if (a.type === 'propInstance') {
        if (!a.bob && !a.spin) continue;
        for (let i = 0; i < a.data.length; i++) {
          const d = a.data[i];
          const y = a.bob ? d.yOff * d.s + Math.sin(elapsed * 1.4 + d.phase) * 0.15 : d.yOff * d.s;
          a.dummy.position.set(d.x, y, d.z);
          a.dummy.rotation.y = a.spin ? elapsed * 0.4 + d.phase : 0;
          a.dummy.scale.setScalar(d.s);
          a.dummy.updateMatrix();
          a.mesh.setMatrixAt(i, a.dummy.matrix);
        }
        a.mesh.instanceMatrix.needsUpdate = true;
      } else if (a.type === 'padPulse') {
        const s = 1 + Math.sin(elapsed * 2 + a.phase) * 0.06;
        a.mesh.scale.setScalar(s);
      } else if (a.type === 'gateOpen') {
        a.t += dt;
        const t = Math.min(1, a.t / 1.4);
        a.mesh.position.y = -t * 8;
        a.mesh.rotation.z = t * 0.4;
        a.mesh.scale.setScalar(1 - t * 0.3);
        if (t >= 1) a.mesh.visible = false;
      }
    }
    // remove finished gate animations
    this.animated = this.animated.filter((a) => !(a.type === 'gateOpen' && a.t > 1.4));

    if (this.gooBlob) {
      const g = this.gooBlob;
      g.squashVel += (-g.squashVel * 8 - (g.squash - 1) * 70) * dt;
      g.squash += g.squashVel * dt;
      g.blob.scale.set(g.baseScale / Math.sqrt(g.squash), g.baseScale * g.squash, g.baseScale / Math.sqrt(g.squash));
      g.blob.position.y = 1.6 + Math.sin(elapsed * 1.6) * 0.08;
      g.blob.rotation.y = elapsed * 0.3;
    }
    if (this.vault) {
      this.vault.rotation.y = elapsed * 0.25;
    }
  }

  popGooBlob() {
    if (!this.gooBlob) return;
    this.gooBlob.squashVel -= 4;
  }
}
