// Coral City Heat — keyboard and mouse state.
// One Input object owns the key set, accumulated mouse-look deltas and the
// click flag; systems poll it each frame instead of adding their own listeners.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.clicked = false;
    this.pointerLocked = false;
    this.canvas = canvas;

    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space') event.preventDefault();
      this.keys.add(event.code);
      if (event.code === 'KeyF') this.interactPressed = true;
      if (event.code === 'KeyE') this.usePressed = true;
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('click', () => {
      if (!this.pointerLocked && this.wantsPointerLock) this.lockPointer();
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', (event) => {
      if (!this.pointerLocked) return;
      this.mouseDX += event.movementX || 0;
      this.mouseDY += event.movementY || 0;
    });
    document.addEventListener('mousedown', (event) => {
      if (this.pointerLocked && event.button === 0) this.clicked = true;
    });
    this.wantsPointerLock = false;
    this.interactPressed = false;
    this.usePressed = false;
  }

  lockPointer() {
    if (this.canvas.requestPointerLock) this.canvas.requestPointerLock();
  }

  down(code) {
    return this.keys.has(code);
  }

  axis(negativeCode, positiveCode) {
    return (this.down(positiveCode) ? 1 : 0) - (this.down(negativeCode) ? 1 : 0);
  }

  // Called once at the end of each frame: per-frame deltas and taps reset.
  consumeFrame() {
    const frame = {
      mouseDX: this.mouseDX,
      mouseDY: this.mouseDY,
      clicked: this.clicked,
      interact: this.interactPressed,
      use: this.usePressed,
    };
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.clicked = false;
    this.interactPressed = false;
    this.usePressed = false;
    return frame;
  }
}
