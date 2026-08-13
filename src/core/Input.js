export class Input {
  constructor(domElement) {
    this.dom = domElement;
    this.keys = new Set();
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.deltaX = 0;
    this.deltaY = 0;
    this.wheelDelta = 0;
    this.pointerActive = false;

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    domElement.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      domElement.setPointerCapture(e.pointerId);
    });
    domElement.addEventListener('pointerup', (e) => {
      this.dragging = false;
      try { domElement.releasePointerCapture(e.pointerId); } catch (_) {}
    });
    domElement.addEventListener('pointercancel', () => (this.dragging = false));
    domElement.addEventListener('pointermove', (e) => {
      if (this.dragging) {
        this.deltaX += e.clientX - this.lastX;
        this.deltaY += e.clientY - this.lastY;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
      }
    });
    domElement.addEventListener(
      'wheel',
      (e) => {
        this.wheelDelta += e.deltaY;
        e.preventDefault();
      },
      { passive: false }
    );
  }

  consumeDrag() {
    const d = { x: this.deltaX, y: this.deltaY };
    this.deltaX = 0;
    this.deltaY = 0;
    return d;
  }

  consumeWheel() {
    const w = this.wheelDelta;
    this.wheelDelta = 0;
    return w;
  }

  moveVector() {
    let x = 0;
    let z = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    return { x, z };
  }
}
