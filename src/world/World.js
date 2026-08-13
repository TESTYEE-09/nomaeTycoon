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
    this._buildSky();
    this._buildClouds();
    ZONES.forEach((zone, i) => this._buildZone(zone, i));
    this._buildTycoonPads();
    this._buildGooBlob();
    this._buildPaths();
  }

  _buildLighting() {
    const hemi = new THREE.HemisphereLight(0xbdf3ff, 0x3a2e55, 0.9);
    this.scene.add(hemi);
    this.hemi = hemi;
    const sun = new THREE.DirectionalLight(0xfff2d8, 1.2);
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
    const fill = new THREE.DirectionalLight(0x88aaff, 0.3);
    fill.position.set(-15, 10, -10);
    this.scene.add(fill);
    // rim light from behind keeps slimes readable against dark zones
    const rim = new THREE.DirectionalLight(0xff9ecb, 0.22);
    rim.position.set(0, 8, -24);
    this.scene.add(rim);
  }

  // A gradient dome that takes its colors from the scene's own sky/fog
  // colors, so the existing zone cross-fade drives it for free.
  _buildSky() {
    this.skyUniforms = {
      topColor: { value: new THREE.Color(0x8fd9ff) },
      bottomColor: { value: new THREE.Color(0xffe9c4) },
      offset: { value: 12 },
      exponent: { value: 0.72 },
    };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(220, 32, 20),
      new THREE.ShaderMaterial({
        uniforms: this.skyUniforms,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: `
          varying vec3 vWorldPos;
          void main() {
            vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 topColor;
          uniform vec3 bottomColor;
          uniform float offset;
          uniform float exponent;
          varying vec3 vWorldPos;
          void main() {
            float h = normalize(vWorldPos + vec3(0.0, offset, 0.0)).y;
            float t = pow(clamp(h, 0.0, 1.0), exponent);
            vec3 col = mix(bottomColor, topColor, t);
            // subtle banding-free dither
            col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.008;
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      })
    );
    sky.renderOrder = -1;
    sky.frustumCulled = false;
    this.scene.add(sky);
    this.sky = sky;

    // Distant star field — invisible in bright zones, gorgeous in the Void.
    const starCount = 700;
    const pos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.random() * 0.6 + 0.1; // upper hemisphere only
      const r = 190;
      pos[i * 3] = Math.cos(u) * Math.cos(v) * r;
      pos[i * 3 + 1] = Math.sin(v) * r;
      pos[i * 3 + 2] = Math.sin(u) * Math.cos(v) * r;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.6,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    });
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);
  }

  _buildClouds() {
    const count = 30;
    const geo = new THREE.IcosahedronGeometry(4.2, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1,
      transparent: true,
      opacity: 0.5,
      fog: false,
      flatShading: true,
    });
    const inst = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();
    const rand = mulberry32(4242);
    this.cloudData = [];
    for (let i = 0; i < count; i++) {
      const x = (rand() - 0.2) * ZONE_SPACING * ZONES.length;
      const y = 34 + rand() * 22;
      const z = (rand() - 0.5) * 180;
      const s = 0.8 + rand() * 1.9;
      this.cloudData.push({ x, y, z, s, speed: 0.4 + rand() * 0.8 });
      dummy.position.set(x, y, z);
      dummy.scale.set(s * 1.6, s * 0.55, s);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.frustumCulled = false;
    this.scene.add(inst);
    this.clouds = inst;
    this._cloudDummy = dummy;
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

    // island underside so zones read as floating discs, not flat decals
    const skirt = new THREE.Mesh(
      new THREE.ConeGeometry(ZONE_RADIUS, 14, 48, 1, true),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(zone.color).multiplyScalar(0.45),
        roughness: 1,
        side: THREE.DoubleSide,
        flatShading: true,
      })
    );
    skirt.rotation.x = Math.PI;
    skirt.position.set(cx, -7, 0);
    this.scene.add(skirt);

    this._scatterProps(zone, cx, index);
    this._scatterRocks(zone, cx, index);
    this._buildMotes(zone, cx, index);
    if (zone.id === 'puddle') this._buildLake(cx);

    if (index > 0) {
      this._buildGate(zone, cx);
    }
  }

  // Chunky boulders hugging the rim: cheap silhouette, big readability win.
  _scatterRocks(zone, cx, index) {
    const rand = mulberry32(index * 104729 + 71);
    const count = 18;
    const inst = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1.4, 0),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(zone.color).multiplyScalar(0.62),
        roughness: 0.95,
        flatShading: true,
      }),
      count
    );
    inst.castShadow = true;
    inst.receiveShadow = true;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + rand() * 0.25;
      const rad = ZONE_RADIUS - 1.5 - rand() * 3;
      const s = 0.7 + rand() * 1.5;
      dummy.position.set(cx + Math.cos(ang) * rad, s * 0.35, Math.sin(ang) * rad);
      dummy.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    this.scene.add(inst);
  }

  // Slow drifting motes tinted to the zone — the cheapest atmosphere there is.
  _buildMotes(zone, cx, index) {
    const rand = mulberry32(index * 5381 + 7);
    const count = 140;
    const pos = new Float32Array(count * 3);
    const data = [];
    for (let i = 0; i < count; i++) {
      const ang = rand() * Math.PI * 2;
      const rad = rand() * ZONE_RADIUS;
      const x = cx + Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad;
      const y = rand() * 14;
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      data.push({ baseY: y, speed: 0.25 + rand() * 0.6, phase: rand() * Math.PI * 2, x, z });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: new THREE.Color(zone.fog || zone.color).lerp(new THREE.Color(0xffffff), 0.45),
        size: 0.3,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.scene.add(points);
    this.animated.push({ type: 'motes', mesh: points, data });
  }

  // A goo pond with expanding ripple rings in the starting zone.
  _buildLake(cx) {
    const lake = new THREE.Mesh(
      new THREE.CircleGeometry(9, 48),
      new THREE.MeshStandardMaterial({
        color: 0x36d98a,
        emissive: 0x0f7a4a,
        emissiveIntensity: 0.5,
        roughness: 0.12,
        metalness: 0.25,
        transparent: true,
        opacity: 0.88,
      })
    );
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(cx - 20, 0.06, -20);
    lake.receiveShadow = true;
    this.scene.add(lake);

    const ripples = [];
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1, 1.25, 40),
        new THREE.MeshBasicMaterial({ color: 0x9dffd0, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(lake.position.x, 0.09, lake.position.z);
      this.scene.add(ring);
      ripples.push({ mesh: ring, t: i / 3 });
    }
    this.animated.push({ type: 'ripples', ripples });
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

    // glow shell + orbiting bubbles so the tap target reads as *the* thing
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(2.1, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0x54ffb0, transparent: true, opacity: 0.13, side: THREE.BackSide, depthWrite: false })
    );
    glow.position.y = 1.6;
    group.add(glow);

    const bubbles = [];
    const bubbleMat = new THREE.MeshStandardMaterial({ color: 0x9dffd0, emissive: 0x2fbe80, emissiveIntensity: 0.7, roughness: 0.2 });
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.16 + Math.random() * 0.12, 10, 8), bubbleMat);
      group.add(b);
      bubbles.push({ mesh: b, radius: 2.1 + Math.random() * 0.5, speed: 0.5 + Math.random() * 0.7, phase: Math.random() * 6.28, tilt: Math.random() * 0.8 });
    }

    const light = new THREE.PointLight(0x54ffb0, 18, 22, 2);
    light.position.y = 2;
    group.add(light);

    this.scene.add(group);
    this.gooBlob = { group, blob, glow, bubbles, light, baseScale: 1, squash: 1, squashVel: 0 };

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

  // Bridges between zones: a plank deck with glowing edge strips and
  // lanterns, so the walk between islands is a scene of its own.
  _buildPaths() {
    const deckMat = new THREE.MeshStandardMaterial({ color: 0xb08d5c, roughness: 0.95 });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x7cffd0, transparent: true, opacity: 0.55 });
    const lanternMat = new THREE.MeshStandardMaterial({ color: 0xffd54a, emissive: 0xffb400, emissiveIntensity: 1.2, roughness: 0.4 });

    for (let i = 0; i < ZONES.length - 1; i++) {
      const x1 = i * ZONE_SPACING + ZONE_RADIUS - 2;
      const x2 = (i + 1) * ZONE_SPACING - ZONE_RADIUS + 2;
      const len = x2 - x1;
      const midX = (x1 + x2) / 2;

      const deck = new THREE.Mesh(new THREE.BoxGeometry(len, 0.35, 5), deckMat);
      deck.position.set(midX, 0.05, 0);
      deck.receiveShadow = true;
      this.scene.add(deck);

      for (const side of [-1, 1]) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.25), glowMat);
        strip.position.set(midX, 0.26, side * 2.4);
        this.scene.add(strip);
      }

      const lanternCount = Math.max(2, Math.round(len / 12));
      for (let j = 0; j <= lanternCount; j++) {
        for (const side of [-1, 1]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.2, 6), deckMat);
          const px = x1 + (len * j) / lanternCount;
          post.position.set(px, 1.1, side * 2.4);
          post.castShadow = true;
          this.scene.add(post);
          const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), lanternMat);
          lamp.position.set(px, 2.35, side * 2.4);
          this.scene.add(lamp);
          this.animated.push({ type: 'lantern', mesh: lamp, phase: (j + side) * 1.3 });
        }
      }
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
      } else if (a.type === 'motes') {
        const arr = a.mesh.geometry.attributes.position.array;
        for (let i = 0; i < a.data.length; i++) {
          const d = a.data[i];
          arr[i * 3] = d.x + Math.sin(elapsed * 0.3 + d.phase) * 1.2;
          arr[i * 3 + 1] = ((d.baseY + elapsed * d.speed) % 14) + 0.4;
          arr[i * 3 + 2] = d.z + Math.cos(elapsed * 0.25 + d.phase) * 1.2;
        }
        a.mesh.geometry.attributes.position.needsUpdate = true;
      } else if (a.type === 'ripples') {
        for (const r of a.ripples) {
          r.t += dt * 0.35;
          if (r.t > 1) r.t -= 1;
          r.mesh.scale.setScalar(0.4 + r.t * 6.5);
          r.mesh.material.opacity = 0.5 * (1 - r.t);
        }
      } else if (a.type === 'lantern') {
        a.mesh.scale.setScalar(1 + Math.sin(elapsed * 2.4 + a.phase) * 0.09);
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

    // Sky dome + stars follow whatever colors the zone cross-fade set.
    if (this.sky && this.scene.background && this.scene.background.isColor) {
      const base = this.scene.background;
      this.skyUniforms.topColor.value.copy(base).multiplyScalar(0.82);
      const bottom = this.scene.fog ? this.scene.fog.color : base;
      this.skyUniforms.bottomColor.value.copy(bottom).lerp(new THREE.Color(0xffffff), 0.18);
      // stars fade in as the sky gets dark
      const lum = base.r * 0.299 + base.g * 0.587 + base.b * 0.114;
      const want = THREE.MathUtils.clamp(1 - lum * 2.2, 0, 0.9);
      this.starMat.opacity += (want - this.starMat.opacity) * Math.min(1, dt * 2);
      this.clouds.material.opacity = 0.5 * (1 - want);
    }

    if (this.clouds) {
      const span = ZONE_SPACING * ZONES.length;
      for (let i = 0; i < this.cloudData.length; i++) {
        const c = this.cloudData[i];
        c.x += c.speed * dt;
        if (c.x > span) c.x -= span + 60;
        this._cloudDummy.position.set(c.x, c.y + Math.sin(elapsed * 0.2 + i) * 0.6, c.z);
        this._cloudDummy.rotation.set(0, 0, 0);
        this._cloudDummy.scale.set(c.s * 1.6, c.s * 0.55, c.s);
        this._cloudDummy.updateMatrix();
        this.clouds.setMatrixAt(i, this._cloudDummy.matrix);
      }
      this.clouds.instanceMatrix.needsUpdate = true;
    }

    if (this.gooBlob) {
      const g = this.gooBlob;
      for (const b of g.bubbles) {
        const a2 = elapsed * b.speed + b.phase;
        b.mesh.position.set(Math.cos(a2) * b.radius, 1.6 + Math.sin(a2 * 1.7) * 0.9, Math.sin(a2) * b.radius * (1 - b.tilt * 0.4));
      }
      g.glow.scale.setScalar(1 + Math.sin(elapsed * 1.9) * 0.05);
      g.light.intensity = 16 + Math.sin(elapsed * 3) * 4;
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
