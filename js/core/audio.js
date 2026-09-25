/* MAGGAR.io — WebAudio ile sentezlenen sesler (ses dosyası indirilmez) */
(function (MG) {
  'use strict';

  const A = {
    ctx: null,
    master: null,
    enabled: true,
    volume: 0.6,
    lastPellet: 0,

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume * 0.5;
        this.master.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; }
    },

    setVolume(v) {
      this.volume = v;
      if (this.master) this.master.gain.value = v * 0.5;
    },

    tone(freq, dur, type, vol, slide, delay) {
      const c = this.ctx;
      if (!c || !this.enabled) return;
      const t = c.currentTime + (delay || 0);
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    },

    noise(dur, freq, vol, delay) {
      const c = this.ctx;
      if (!c || !this.enabled) return;
      const t = c.currentTime + (delay || 0);
      const len = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const s = c.createBufferSource();
      s.buffer = buf;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq || 1200;
      const g = c.createGain();
      g.gain.value = vol || 0.2;
      s.connect(f); f.connect(g); g.connect(this.master);
      s.start(t);
    },

    play(name) {
      if (!this.ctx || !this.enabled) return;
      const r = Math.random;
      switch (name) {
        case 'pellet': {
          const now = performance.now();
          if (now - this.lastPellet < 70) return;
          this.lastPellet = now;
          this.tone(900 + r() * 500, 0.05, 'sine', 0.035);
          break;
        }
        case 'eat': this.tone(420, 0.16, 'triangle', 0.22, 140); this.tone(700, 0.08, 'sine', 0.1, 300, 0.03); break;
        case 'split': this.noise(0.12, 2200, 0.12); this.tone(300, 0.1, 'sine', 0.08, 700); break;
        case 'eject': this.tone(260 + r() * 60, 0.05, 'square', 0.03, 180); break;
        case 'pop': this.noise(0.25, 500, 0.3); this.tone(180, 0.25, 'sawtooth', 0.08, 60); break;
        case 'power': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.12, 0, i * 0.06)); break;
        case 'use': this.tone(300, 0.3, 'sawtooth', 0.08, 900); this.noise(0.2, 3000, 0.06); break;
        case 'event': this.tone(660, 0.18, 'square', 0.07); this.tone(880, 0.25, 'square', 0.07, 0, 0.18); break;
        case 'death': this.tone(400, 0.6, 'sawtooth', 0.12, 60); break;
        case 'level': [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.13, 0, i * 0.08)); break;
        case 'achievement': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.2, 'sine', 0.12, 0, i * 0.07)); break;
        case 'click': this.tone(1200, 0.03, 'sine', 0.06); break;
        case 'chat': this.tone(1500, 0.05, 'sine', 0.05); this.tone(1900, 0.05, 'sine', 0.04, 0, 0.05); break;
        case 'alarm': this.tone(520, 0.2, 'square', 0.06); this.tone(520, 0.2, 'square', 0.06, 0, 0.3); break;
        case 'meteor': this.noise(0.5, 200, 0.25); break;
        case 'teleport': this.tone(200, 0.35, 'sine', 0.1, 1600); break;
        case 'win': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.14, 0, i * 0.11)); break;
      }
    }
  };

  MG.Audio = A;
})(window.MG = window.MG || {});
