// All sound is synthesised with WebAudio: no audio files, no network.
// One clear job: every beep, chime, whoosh and jingle the game makes.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  // Created lazily on the first user gesture so browsers allow audio.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.42;
      this.master.connect(this.ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.42;
  }

  tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  noise(dur, vol, filterFreq, when = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 0.8;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  launch() {
    this.noise(0.45, 0.5, 900);
    this.tone(180, 0.35, 'sine', 0.25, 0, 620);
  }

  collect(combo) {
    const base = 660 + Math.min(combo, 8) * 55;
    this.tone(base, 0.14, 'sine', 0.4);
    this.tone(base * 1.5, 0.2, 'sine', 0.32, 0.07);
    this.tone(base * 2, 0.26, 'triangle', 0.22, 0.14);
  }

  nova() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.3, i * 0.08));
  }

  crash() {
    this.noise(0.35, 0.55, 220);
    this.tone(140, 0.4, 'sawtooth', 0.3, 0, 40);
  }

  waveClear() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.32, i * 0.09));
  }

  gameOver() {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.42, 'sine', 0.32, i * 0.16));
  }

  victory() {
    const seq = [523, 659, 784, 1047, 784, 1047, 1319, 1568];
    seq.forEach((f, i) => this.tone(f, 0.34, 'triangle', 0.3, i * 0.11));
    this.tone(262, 1.1, 'sine', 0.18, 0);
    this.tone(1319, 1.1, 'sine', 0.12, 0.9);
  }

  click() {
    this.tone(880, 0.06, 'square', 0.12);
  }

  // A quiet looping arpeggio under play; started once, stopped on menus.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const scale = [220, 262, 330, 392, 440, 523];
    this.musicTimer = window.setInterval(() => {
      if (this.muted || !this.ctx) return;
      const note = scale[this.musicStep % scale.length];
      this.tone(note, 0.5, 'sine', 0.05);
      if (this.musicStep % 4 === 2) this.tone(note / 2, 0.7, 'sine', 0.04);
      this.musicStep += 1;
    }, 320);
  }

  stopMusic() {
    if (this.musicTimer) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
