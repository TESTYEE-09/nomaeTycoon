// Simple generic object pool to avoid per-frame garbage.
export class Pool {
  constructor(create, reset, initialSize = 0) {
    this.create = create;
    this.reset = reset;
    this.free = [];
    for (let i = 0; i < initialSize; i++) this.free.push(create());
  }

  acquire() {
    const obj = this.free.pop() || this.create();
    return obj;
  }

  release(obj) {
    this.reset(obj);
    this.free.push(obj);
  }
}
