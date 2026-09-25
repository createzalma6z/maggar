/* MAGGAR.io — skin üretimi (harici görsel yok, hepsi kodla çizilir) */
(function (MG) {
  'use strict';
  const U = MG.U;
  const SIZE = 256;
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';

  function canvas(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size || SIZE;
    return c;
  }

  const PATTERNS = {
    rings(g, col) {
      const h = SIZE / 2;
      g.fillStyle = '#0b0b18'; g.fillRect(0, 0, SIZE, SIZE);
      for (let i = 9; i > 0; i--) {
        g.beginPath(); g.arc(h, h, i * 14, 0, U.TAU);
        g.lineWidth = 6;
        g.strokeStyle = i % 2 ? col.fill : '#ffffff';
        g.shadowColor = col.fill; g.shadowBlur = 10;
        g.stroke();
      }
      g.shadowBlur = 0;
    },
    checker(g, col) {
      const n = 8, s = SIZE / n;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        g.fillStyle = (x + y) % 2 ? col.fill : '#141420';
        g.fillRect(x * s, y * s, s, s);
      }
    },
    stripes(g) {
      g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, SIZE, SIZE);
      g.strokeStyle = '#111'; g.lineWidth = 16;
      for (let i = -SIZE; i < SIZE * 2; i += 44) {
        g.beginPath();
        g.moveTo(i, 0);
        g.bezierCurveTo(i + 30, SIZE * 0.3, i - 20, SIZE * 0.7, i + 20, SIZE);
        g.stroke();
      }
    },
    galaxy(g) {
      const h = SIZE / 2;
      const gr = g.createRadialGradient(h, h, 5, h, h, h);
      gr.addColorStop(0, '#fff2ff'); gr.addColorStop(0.15, '#c86bff'); gr.addColorStop(0.5, '#3a1470'); gr.addColorStop(1, '#07031a');
      g.fillStyle = gr; g.fillRect(0, 0, SIZE, SIZE);
      g.save(); g.translate(h, h);
      for (let arm = 0; arm < 3; arm++) {
        for (let i = 0; i < 90; i++) {
          const t = i / 90, a = arm * (U.TAU / 3) + t * 5;
          const d = t * h * 0.95;
          g.fillStyle = 'rgba(255,' + (180 + ((t * 70) | 0)) + ',255,' + (0.7 - t * 0.5) + ')';
          g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, 5 - t * 3.5, 0, U.TAU); g.fill();
        }
      }
      g.restore();
      for (let i = 0; i < 60; i++) {
        g.fillStyle = 'rgba(255,255,255,' + Math.random() + ')';
        g.fillRect(Math.random() * SIZE, Math.random() * SIZE, 2, 2);
      }
    },
    spiral(g, col) {
      const h = SIZE / 2;
      g.fillStyle = col.fill; g.fillRect(0, 0, SIZE, SIZE);
      g.strokeStyle = '#ffffff'; g.lineWidth = 12; g.lineCap = 'round';
      g.beginPath();
      for (let i = 0; i < 400; i++) {
        const t = i / 400, a = t * 6 * Math.PI, d = t * h;
        const x = h + Math.cos(a) * d, y = h + Math.sin(a) * d;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    },
    rainbow(g) {
      const h = SIZE / 2;
      if (g.createConicGradient) {
        const gr = g.createConicGradient(0, h, h);
        ['#ff3355', '#ff9933', '#ffee33', '#33ff77', '#33ccff', '#6655ff', '#dd44ff', '#ff3355'].forEach((c, i, a) => gr.addColorStop(i / (a.length - 1), c));
        g.fillStyle = gr;
      } else {
        const gr = g.createLinearGradient(0, 0, SIZE, SIZE);
        ['#ff3355', '#ffee33', '#33ff77', '#33ccff', '#dd44ff'].forEach((c, i, a) => gr.addColorStop(i / (a.length - 1), c));
        g.fillStyle = gr;
      }
      g.fillRect(0, 0, SIZE, SIZE);
      const w = g.createRadialGradient(h, h, 0, h, h, h);
      w.addColorStop(0, 'rgba(255,255,255,0.8)'); w.addColorStop(0.35, 'rgba(255,255,255,0)');
      g.fillStyle = w; g.fillRect(0, 0, SIZE, SIZE);
    },
    hex(g, col) {
      g.fillStyle = '#1a1405'; g.fillRect(0, 0, SIZE, SIZE);
      const s = 22, hgt = Math.sqrt(3) * s;
      g.lineWidth = 4;
      for (let row = -1; row < SIZE / hgt + 2; row++) {
        for (let q = -1; q < SIZE / (s * 1.5) + 2; q++) {
          const x = q * s * 1.5, y = row * hgt + (q % 2 ? hgt / 2 : 0);
          g.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * U.TAU;
            const px = x + Math.cos(a) * s * 0.92, py = y + Math.sin(a) * s * 0.92;
            if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
          }
          g.closePath();
          g.fillStyle = (row + q) % 3 === 0 ? '#ffc21a' : '#f0a800';
          g.fill();
          g.strokeStyle = '#6b4a00'; g.stroke();
        }
      }
    },
    grid(g, col) {
      g.fillStyle = '#05050d'; g.fillRect(0, 0, SIZE, SIZE);
      g.strokeStyle = col.fill; g.lineWidth = 3; g.shadowColor = col.fill; g.shadowBlur = 8;
      for (let i = 0; i <= SIZE; i += 32) {
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i, SIZE); g.stroke();
        g.beginPath(); g.moveTo(0, i); g.lineTo(SIZE, i); g.stroke();
      }
      g.shadowBlur = 0;
    },
    melon(g) {
      const h = SIZE / 2;
      g.fillStyle = '#1f7a1f'; g.fillRect(0, 0, SIZE, SIZE);
      g.fillStyle = '#b8f28a'; g.beginPath(); g.arc(h, h, h * 0.86, 0, U.TAU); g.fill();
      g.fillStyle = '#ff3d57'; g.beginPath(); g.arc(h, h, h * 0.78, 0, U.TAU); g.fill();
      g.fillStyle = '#111';
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * U.TAU + (i % 2) * 0.2, d = h * (i % 2 ? 0.45 : 0.62);
        g.save(); g.translate(h + Math.cos(a) * d, h + Math.sin(a) * d); g.rotate(a);
        g.beginPath(); g.ellipse(0, 0, 9, 5, 0, 0, U.TAU); g.fill(); g.restore();
      }
    },
    planet(g, col) {
      const bands = ['#e8c38a', '#c98b4b', '#f3dcae', '#a8683a', '#e0b07a', '#8f5a33', '#f0cf9a'];
      const s = SIZE / bands.length;
      bands.forEach((b, i) => { g.fillStyle = b; g.fillRect(0, i * s, SIZE, s + 1); });
      g.fillStyle = 'rgba(180,70,40,0.8)';
      g.beginPath(); g.ellipse(SIZE * 0.65, SIZE * 0.6, 26, 14, 0, 0, U.TAU); g.fill();
      const h = SIZE / 2;
      const sh = g.createRadialGradient(h * 0.7, h * 0.6, 10, h, h, h * 1.1);
      sh.addColorStop(0, 'rgba(255,255,255,0.25)'); sh.addColorStop(1, 'rgba(0,0,0,0.45)');
      g.fillStyle = sh; g.fillRect(0, 0, SIZE, SIZE);
    },
    eye(g, col) {
      const h = SIZE / 2;
      g.fillStyle = '#fafafa'; g.fillRect(0, 0, SIZE, SIZE);
      g.strokeStyle = 'rgba(220,60,60,0.35)'; g.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * U.TAU;
        g.beginPath(); g.moveTo(h + Math.cos(a) * h, h + Math.sin(a) * h);
        g.quadraticCurveTo(h + Math.cos(a + 0.3) * h * 0.7, h + Math.sin(a + 0.3) * h * 0.7, h + Math.cos(a) * h * 0.5, h + Math.sin(a) * h * 0.5);
        g.stroke();
      }
      const ir = g.createRadialGradient(h, h, 10, h, h, h * 0.48);
      ir.addColorStop(0, col.fill); ir.addColorStop(1, col.stroke);
      g.fillStyle = ir; g.beginPath(); g.arc(h, h, h * 0.48, 0, U.TAU); g.fill();
      g.fillStyle = '#050505'; g.beginPath(); g.arc(h, h, h * 0.22, 0, U.TAU); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(h - 18, h - 20, 12, 0, U.TAU); g.fill();
    }
  };

  class SkinCache {
    constructor() { this.cache = new Map(); this.byId = {}; for (const s of MG.SKINS) this.byId[s.id] = s; }
    def(id) { return this.byId[id] || null; }
    // Hücre içine çizilecek kare görsel (daire kırpması çizimde yapılır)
    get(id, color) {
      const d = this.byId[id];
      if (!d || d.type === 'none') return null;
      const key = d.pattern ? id + color.hex : id;
      let c = this.cache.get(key);
      if (c) return c;
      c = canvas();
      const g = c.getContext('2d');
      if (d.pattern) {
        (PATTERNS[d.pattern] || PATTERNS.rings)(g, color);
      } else if (d.emoji) {
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = '176px ' + EMOJI_FONT;
        g.fillText(d.emoji, SIZE / 2, SIZE / 2 + 12);
      }
      c.fullBleed = !!d.pattern;
      if (this.cache.size > 200) this.cache.clear();
      this.cache.set(key, c);
      return c;
    }
    // Menü önizlemesi için yuvarlak ikon
    preview(id, color, size) {
      size = size || 96;
      const c = canvas(size);
      const g = c.getContext('2d');
      const h = size / 2;
      g.beginPath(); g.arc(h, h, h - 3, 0, U.TAU);
      g.fillStyle = color.fill; g.fill();
      const img = this.get(id, color);
      if (img) {
        g.save(); g.clip();
        if (img.fullBleed) g.drawImage(img, 3, 3, size - 6, size - 6);
        else g.drawImage(img, size * 0.12, size * 0.12, size * 0.76, size * 0.76);
        g.restore();
      }
      g.lineWidth = Math.max(3, size * 0.06);
      g.strokeStyle = color.stroke;
      g.beginPath(); g.arc(h, h, h - 3, 0, U.TAU); g.stroke();
      return c;
    }
  }

  MG.SkinCache = SkinCache;
  MG.EMOJI_FONT = EMOJI_FONT;
})(window.MG = window.MG || {});
