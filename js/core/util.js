/* MAGGAR.io — yardımcı fonksiyonlar */
(function (MG) {
  'use strict';

  const TAU = Math.PI * 2;

  const U = {
    TAU,

    clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
    lerp(a, b, t) { return a + (b - a) * t; },
    rand(a, b) { return a + Math.random() * (b - a); },
    randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
    pick(arr) { return arr[(Math.random() * arr.length) | 0]; },
    chance(p) { return Math.random() < p; },

    dist(ax, ay, bx, by) {
      const dx = bx - ax, dy = by - ay;
      return Math.sqrt(dx * dx + dy * dy);
    },
    dist2(ax, ay, bx, by) {
      const dx = bx - ax, dy = by - ay;
      return dx * dx + dy * dy;
    },

    massToRadius(m) { return Math.sqrt(m * 100); },
    radiusToMass(r) { return (r * r) / 100; },

    angleDiff(a, b) {
      let d = (b - a) % TAU;
      if (d > Math.PI) d -= TAU;
      else if (d < -Math.PI) d += TAU;
      return d;
    },

    // [[değer, ağırlık], ...] listesinden ağırlıklı seçim
    weighted(pairs) {
      let total = 0;
      for (const p of pairs) total += p[1];
      let r = Math.random() * total;
      for (const p of pairs) {
        r -= p[1];
        if (r <= 0) return p[0];
      }
      return pairs[pairs.length - 1][0];
    },

    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    },

    // Tohumlu rastgele sayı üreteci (günlük görevler için)
    mulberry32(seed) {
      let a = seed >>> 0;
      return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },

    hashStr(s) {
      let h = 2166136261 >>> 0;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    },

    formatTime(sec) {
      sec = Math.max(0, Math.floor(sec));
      const m = Math.floor(sec / 60), s = sec % 60;
      return m + ':' + (s < 10 ? '0' : '') + s;
    },

    formatNum(n) {
      n = Math.floor(n);
      const sep = MG.I18N && MG.I18N.lang === 'tr' ? '.' : ',';
      return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
    },

    makeColor(r, g, b) {
      r = U.clamp(r | 0, 0, 255); g = U.clamp(g | 0, 0, 255); b = U.clamp(b | 0, 0, 255);
      const dk = 0.82;
      const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
      return {
        r, g, b, hex,
        fill: 'rgb(' + r + ',' + g + ',' + b + ')',
        stroke: 'rgb(' + ((r * dk) | 0) + ',' + ((g * dk) | 0) + ',' + ((b * dk) | 0) + ')',
        glow: 'rgba(' + r + ',' + g + ',' + b + ',0.45)'
      };
    },

    fromHex(hex) {
      const h = hex.replace('#', '');
      const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
      return U.makeColor((n >> 16) & 255, (n >> 8) & 255, n & 255);
    },

    // Orijinal oyundaki gibi: bir kanal 255, biri 7, biri rastgele
    randomCellColor() {
      const vals = [255, 7, (Math.random() * 256) | 0];
      U.shuffle(vals);
      return U.makeColor(vals[0], vals[1], vals[2]);
    },

    rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; },

    // Yumuşak 1B gürültü (botların doğal gezinmesi için)
    smoothNoise(t, seed) {
      return (
        Math.sin(t * 0.73 + seed) * 0.5 +
        Math.sin(t * 1.37 + seed * 2.1) * 0.3 +
        Math.sin(t * 2.91 + seed * 0.7) * 0.2
      );
    },

    todayKey() {
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },

    escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
  };

  MG.U = U;
})(window.MG = window.MG || {});
