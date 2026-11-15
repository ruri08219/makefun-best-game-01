// Keyboard + mouse input, translated into game intent.
// One clear job: read the devices, expose aim, launch and menu actions.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.mouseX = 640;
    this.mouseY = 300;
    this.mouseDown = false;
    this.dragging = false;
    this.downEdge = false; // true on the frame a pointer press begins
    this.upEdge = false; // true on the frame a pointer press ends
    this.aimAngle = -Math.PI / 2;
    this.aimPower = 0.7;
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered keys, consumed each frame
    this.onFirstGesture = null;
    this._bind();
  }

  _toGame(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 1280,
      y: ((clientY - rect.top) / rect.height) * 720,
    };
  }

  _bind() {
    const canvas = this.canvas;
    const gesture = () => {
      if (this.onFirstGesture) this.onFirstGesture();
    };
    canvas.addEventListener('pointerdown', (e) => {
      gesture();
      const p = this._toGame(e.clientX, e.clientY);
      this.mouseX = p.x;
      this.mouseY = p.y;
      this.mouseDown = true;
      this.dragging = true;
      this.downEdge = true;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = this._toGame(e.clientX, e.clientY);
      this.mouseX = p.x;
      this.mouseY = p.y;
    });
    canvas.addEventListener('pointerup', (e) => {
      const p = this._toGame(e.clientX, e.clientY);
      this.mouseX = p.x;
      this.mouseY = p.y;
      this.mouseDown = false;
      this.dragging = false;
      this.upEdge = true;
    });
    window.addEventListener('keydown', (e) => {
      gesture();
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.key.toLowerCase());
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
      this.dragging = false;
    });
  }

  // True once on the frame the key went down; call after reading.
  wasPressed(key) {
    return this.pressed.has(key.toLowerCase());
  }

  endFrame() {
    this.pressed.clear();
    this.downEdge = false;
    this.upEdge = false;
  }

  // Keyboard aiming: left/right rotate, up/down change power.
  updateAim(dt) {
    const speed = 2.4;
    if (this.keys.has('arrowleft') || this.keys.has('a')) this.aimAngle -= speed * dt;
    if (this.keys.has('arrowright') || this.keys.has('d')) this.aimAngle += speed * dt;
    if (this.keys.has('arrowup') || this.keys.has('w')) this.aimPower = Math.min(1, this.aimPower + dt * 0.9);
    if (this.keys.has('arrowdown') || this.keys.has('s')) this.aimPower = Math.max(0.25, this.aimPower - dt * 0.9);
    // Mouse aim: the launcher points at the cursor while the player drags,
    // and the drag distance sets the power.
    if (this.dragging) {
      const dx = this.mouseX - 640;
      const dy = this.mouseY - 660;
      const dist = Math.hypot(dx, dy);
      if (dist > 24) {
        this.aimAngle = Math.atan2(dy, dx);
        this.aimPower = Math.min(1, Math.max(0.25, dist / 420));
      }
    }
    // Keep the aim upward-ish: never point the comet into the floor.
    if (this.aimAngle > -0.12 && this.aimAngle < Math.PI / 2) this.aimAngle = -0.12;
    if (this.aimAngle < -Math.PI + 0.12 && this.aimAngle > -Math.PI) this.aimAngle = -Math.PI + 0.12;
    if (this.aimAngle > Math.PI / 2 && this.aimAngle < Math.PI - 0.12) this.aimAngle = Math.PI - 0.12;
  }

  launchVelocity() {
    const { minLaunchSpeed, maxLaunchSpeed } = { minLaunchSpeed: 260, maxLaunchSpeed: 780 };
    const speed = minLaunchSpeed + (maxLaunchSpeed - minLaunchSpeed) * this.aimPower;
    return { x: Math.cos(this.aimAngle) * speed, y: Math.sin(this.aimAngle) * speed };
  }
}
