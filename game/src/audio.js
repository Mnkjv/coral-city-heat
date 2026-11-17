// Coral City Heat — procedural WebAudio sound.
// No audio files: every sound is synthesized — engine hum pitched by speed,
// a two-tone siren, noise-burst gunshots, thuds, chimes and a quiet pad loop.

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenFlipAt = 0;
    this.sirenHigh = false;
  }

  // Browsers only allow audio after a user gesture; called on first click.
  startOnFirstGesture() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    this.ctx = new AudioCtor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this.startAmbientPad();
    this.startEngineHum();
    this.startSiren();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  tone(freq, duration, type, volume, slideTo) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + duration);
    gain.gain.setValueAtTime(volume || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  noiseBurst(duration, volume, lowpassFreq) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpassFreq || 1800;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
  }

  playGunshot() {
    this.noiseBurst(0.16, 0.5, 2600);
    this.tone(150, 0.1, 'square', 0.18, 55);
  }

  playHitThud() {
    this.tone(90, 0.18, 'sine', 0.4, 40);
    this.noiseBurst(0.08, 0.2, 500);
  }

  playCashChime() {
    this.tone(880, 0.12, 'triangle', 0.25);
    setTimeout(() => this.tone(1318, 0.2, 'triangle', 0.25), 70);
  }

  playMissionJingle() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((freq, i) => setTimeout(() => this.tone(freq, 0.22, 'triangle', 0.28), i * 110));
  }

  playHurt() {
    this.tone(220, 0.15, 'sawtooth', 0.2, 110);
  }

  startAmbientPad() {
    const gain = this.ctx.createGain();
    gain.gain.value = 0.035;
    gain.connect(this.master);
    [110, 164.8, 220].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = i * 4 - 4;
      osc.connect(gain);
      osc.start();
    });
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();
  }

  startEngineHum() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filter).connect(this.engineGain).connect(this.master);
    this.engineOsc.start();
  }

  startSiren() {
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain).connect(this.master);
    this.sirenOsc.start();
  }

  // engineLevel 0..1 (0 = engine off), sirenLevel 0..1 (0 = no police near).
  updateAudio(dt, engineLevel, sirenLevel) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.engineGain) {
      const target = engineLevel > 0 ? 0.05 + engineLevel * 0.07 : 0;
      this.engineGain.gain.setTargetAtTime(target, t, 0.08);
      this.engineOsc.frequency.setTargetAtTime(52 + engineLevel * 130, t, 0.08);
    }
    if (this.sirenGain) {
      this.sirenGain.gain.setTargetAtTime(sirenLevel * 0.06, t, 0.15);
      this.sirenFlipAt -= dt;
      if (this.sirenFlipAt <= 0) {
        this.sirenFlipAt = 0.42;
        this.sirenHigh = !this.sirenHigh;
        this.sirenOsc.frequency.setValueAtTime(this.sirenHigh ? 950 : 680, t);
      }
    }
  }
}
