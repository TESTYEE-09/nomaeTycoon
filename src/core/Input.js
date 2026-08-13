// Unified input: keyboard, mouse-look, wheel zoom, touch joystick + touch look.
//
// Control scheme (redone):
//   Movement  WASD / arrows, or the on-screen joystick (drag anywhere on the
//             left half of the screen on touch devices).
//   Look      Drag with the mouse (or drag the right half on touch). A drag
//             only starts steering the camera after a small dead zone, so a
//             quick click stays a click.
//   Zoom      Mouse wheel, or pinch with two fingers.
//   Tap       Short click/tap on the world (fires onTap with screen coords).
//   Interact  E / Space at a machine pad.

const DRAG_DEADZONE = 7; // px before a press becomes a camera drag
const TAP_MAX_MS = 400;
const JOY_RADIUS = 56; // px travel for full-speed movement

export class Input {
  constructor(domElement, { onTap, joystickEl } = {}) {
    this.dom = domElement;
    this.onTap = onTap || (() => {});
    this.joystickEl = joystickEl || null;
    this.joyKnob = joystickEl ? joystickEl.querySelector('.joystick-knob') : null;

    this.keys = new Set();
    this.lookX = 0;
    this.lookY = 0;
    this.wheelDelta = 0;
    this.invertY = false;
    this.lookSensitivity = 1;

    this.joy = { x: 0, z: 0, active: false };

    this._pointers = new Map(); // id -> pointer state
    this._lookId = null;
    this._joyId = null;
    this._pinchDist = 0;

    this._bindKeyboard();
    this._bindPointer();
  }

  // ---------------------------------------------------------------- keyboard
  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      this.keys.add(e.code);
      // stop the page from scrolling / space-clicking a focused button
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  isDown(code) {
    return this.keys.has(code);
  }

  // ----------------------------------------------------------------- pointer
  _isTouchLike(e) {
    return e.pointerType === 'touch' || e.pointerType === 'pen';
  }

  _bindPointer() {
    const dom = this.dom;

    dom.addEventListener('contextmenu', (e) => e.preventDefault());

    dom.addEventListener('pointerdown', (e) => {
      const p = {
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        x: e.clientX,
        y: e.clientY,
        t: performance.now(),
        moved: false,
        touch: this._isTouchLike(e),
      };
      this._pointers.set(e.pointerId, p);
      dom.setPointerCapture(e.pointerId);

      // Touch on the left half drives the virtual joystick; everything else
      // is a look/tap pointer.
      if (p.touch && this._joyId === null && e.clientX < window.innerWidth * 0.5) {
        this._joyId = e.pointerId;
        this._joyOrigin = { x: e.clientX, y: e.clientY };
        this._showJoystick(e.clientX, e.clientY);
      } else if (this._lookId === null) {
        this._lookId = e.pointerId;
      }

      if (this._pointers.size === 2) {
        const [a, b] = [...this._pointers.values()];
        this._pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });

    dom.addEventListener('pointermove', (e) => {
      const p = this._pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) > DRAG_DEADZONE) p.moved = true;

      if (e.pointerId === this._joyId) {
        this._updateJoystick(e.clientX, e.clientY);
        return;
      }

      // two fingers = pinch zoom, no look
      if (this._pointers.size >= 2) {
        const [a, b] = [...this._pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this._pinchDist) this.wheelDelta += (this._pinchDist - d) * 2.2;
        this._pinchDist = d;
        return;
      }

      if (e.pointerId === this._lookId && p.moved) {
        this.lookX += dx;
        this.lookY += dy;
      }
    });

    const end = (e) => {
      const p = this._pointers.get(e.pointerId);
      this._pointers.delete(e.pointerId);
      try { dom.releasePointerCapture(e.pointerId); } catch (_) {}
      if (this._pointers.size < 2) this._pinchDist = 0;

      if (e.pointerId === this._joyId) {
        this._joyId = null;
        this._hideJoystick();
        this.joy.x = 0;
        this.joy.z = 0;
        this.joy.active = false;
        return;
      }
      if (e.pointerId === this._lookId) this._lookId = null;
      if (!p) return;

      const quick = performance.now() - p.t < TAP_MAX_MS;
      if (!p.moved && quick && e.button !== 2) this.onTap(e.clientX, e.clientY);
    };
    dom.addEventListener('pointerup', end);
    dom.addEventListener('pointercancel', (e) => {
      this._pointers.delete(e.pointerId);
      if (e.pointerId === this._joyId) {
        this._joyId = null;
        this._hideJoystick();
        this.joy.x = this.joy.z = 0;
        this.joy.active = false;
      }
      if (e.pointerId === this._lookId) this._lookId = null;
    });

    dom.addEventListener(
      'wheel',
      (e) => {
        this.wheelDelta += e.deltaY;
        e.preventDefault();
      },
      { passive: false }
    );
  }

  // ---------------------------------------------------------------- joystick
  _showJoystick(x, y) {
    if (!this.joystickEl) return;
    this.joystickEl.style.left = x + 'px';
    this.joystickEl.style.top = y + 'px';
    this.joystickEl.classList.add('visible');
    if (this.joyKnob) this.joyKnob.style.transform = 'translate(-50%, -50%)';
  }

  _hideJoystick() {
    if (this.joystickEl) this.joystickEl.classList.remove('visible');
  }

  _updateJoystick(x, y) {
    const dx = x - this._joyOrigin.x;
    const dy = y - this._joyOrigin.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, JOY_RADIUS);
    const nx = dist ? (dx / dist) * (clamped / JOY_RADIUS) : 0;
    const ny = dist ? (dy / dist) * (clamped / JOY_RADIUS) : 0;
    this.joy.x = nx;
    this.joy.z = -ny; // screen-up = forward
    this.joy.active = dist > 4;
    if (this.joyKnob) {
      const kx = dist ? (dx / dist) * clamped : 0;
      const ky = dist ? (dy / dist) * clamped : 0;
      this.joyKnob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
    }
  }

  // ------------------------------------------------------------------ output
  consumeLook() {
    const s = this.lookSensitivity;
    const d = { x: this.lookX * s, y: this.lookY * s * (this.invertY ? -1 : 1) };
    this.lookX = 0;
    this.lookY = 0;
    return d;
  }

  consumeWheel() {
    const w = this.wheelDelta;
    this.wheelDelta = 0;
    return w;
  }

  /** Movement intent in camera space: x = right, z = forward. Magnitude <= 1. */
  moveVector() {
    let x = 0;
    let z = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    if (this.joy.active && Math.hypot(this.joy.x, this.joy.z) > Math.hypot(x, z)) {
      return { x: this.joy.x, z: this.joy.z };
    }
    return { x, z };
  }
}
