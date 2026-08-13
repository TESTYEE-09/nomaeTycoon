import * as THREE from 'three';
import { Pool } from '../utils/pool.js';

const GRAVITY = -9.5;

// ---- 3D particle bursts (pooled meshes, shared geometry) ------------------
export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
    this.geo = new THREE.IcosahedronGeometry(0.09, 0);
    this.geoFlat = new THREE.PlaneGeometry(0.14, 0.14);
    this.pool = new Pool(
      () => {
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false });
        const mesh = new THREE.Mesh(this.geo, mat);
        mesh.visible = false;
        this.scene.add(mesh);
        return mesh;
      },
      (mesh) => {
        mesh.visible = false;
      },
      40
    );
  }

  burst(position, { count = 14, color = 0x6ee7b7, speed = 3.2, spread = 1, life = 0.7, size = 1, gravity = true } = {}) {
    for (let i = 0; i < count; i++) {
      const mesh = this.pool.acquire();
      mesh.visible = true;
      mesh.position.copy(position);
      mesh.scale.setScalar((0.6 + Math.random() * 0.8) * size);
      mesh.material.color.set(color);
      mesh.material.opacity = 1;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * spread;
      const s = speed * (0.5 + Math.random() * 0.8);
      mesh.userData.vel = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * s,
        Math.abs(Math.cos(phi)) * s + 1.5,
        Math.sin(phi) * Math.sin(theta) * s
      );
      mesh.userData.life = life * (0.8 + Math.random() * 0.4);
      mesh.userData.age = 0;
      mesh.userData.gravity = gravity;
      mesh.userData.spin = (Math.random() - 0.5) * 10;
      this.active.push(mesh);
    }
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const m = this.active[i];
      const u = m.userData;
      u.age += dt;
      if (u.age >= u.life) {
        this.active.splice(i, 1);
        this.pool.release(m);
        continue;
      }
      if (u.gravity) u.vel.y += GRAVITY * dt;
      m.position.addScaledVector(u.vel, dt);
      m.rotation.x += u.spin * dt;
      m.rotation.y += u.spin * dt * 0.7;
      const t = u.age / u.life;
      m.material.opacity = 1 - t;
      const sc = m.scale.x;
      m.scale.setScalar(Math.max(0.001, sc * (1 - dt * 0.6)));
    }
  }
}

// ---- Floating combat-text (DOM overlay, pooled) ----------------------------
export class FloatingTextManager {
  constructor(camera, container) {
    this.camera = camera;
    this.container = container;
    this.pool = new Pool(
      () => {
        const el = document.createElement('div');
        el.className = 'floating-text';
        container.appendChild(el);
        return el;
      },
      (el) => {
        el.style.opacity = '0';
        el.className = 'floating-text';
      },
      20
    );
    this.active = [];
  }

  spawn(worldPos, text, { color = '#7CFFB2', big = false } = {}) {
    const el = this.pool.acquire();
    el.textContent = text;
    el.className = 'floating-text' + (big ? ' floating-text--big' : '');
    el.style.color = color;
    el.style.opacity = '1';
    this.active.push({ el, worldPos: worldPos.clone(), age: 0, life: 1.1 + Math.random() * 0.2, driftX: (Math.random() - 0.5) * 40 });
  }

  update(dt, screenW, screenH) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const item = this.active[i];
      item.age += dt;
      const t = item.age / item.life;
      if (t >= 1) {
        this.active.splice(i, 1);
        this.pool.release(item.el);
        continue;
      }
      const p = item.worldPos.clone().project(this.camera);
      const x = (p.x * 0.5 + 0.5) * screenW + item.driftX * t;
      const y = (1 - (p.y * 0.5 + 0.5)) * screenH - t * 70;
      item.el.style.transform = `translate(${x}px, ${y}px) scale(${1 + (1 - t) * 0.15})`;
      item.el.style.opacity = String(1 - Math.pow(t, 2));
    }
  }
}
