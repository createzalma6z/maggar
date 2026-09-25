/* MAGGAR.io — canvas çizim motoru */
(function (MG) {
  'use strict';
  const U = MG.U, K = MG.KIND;
  const TAU = U.TAU;
  const FONT = '"Exo 2", Ubuntu, "Segoe UI", Roboto, Arial, sans-serif';

  // yazı boyutunu oktav başına 4 basamağa yuvarla (önbellek şişmesin)
  function qpx(x) {
    x = x < 10 ? 10 : x > 160 ? 160 : x;
    return Math.round(Math.pow(2, Math.round(Math.log2(x) * 4) / 4));
  }

  function mkCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h || w;
    return c;
  }

  /* ---- metin önbelleği: isimler keskin kalsın diye ekran pikseline göre ---- */
  class TextCache {
    constructor() { this.map = new Map(); }
    get(text, px, color, strokeColor) {
      const key = text + '|' + px + '|' + color + '|' + (strokeColor || '');
      let c = this.map.get(key);
      if (c) return c;
      const font = '700 ' + px + 'px ' + FONT;
      const m = mkCanvas(1, 1).getContext('2d');
      m.font = font;
      const sw = Math.max(2, Math.round(px * 0.14));
      const w = Math.ceil(m.measureText(text).width) + sw * 2 + 4;
      const h = Math.ceil(px * 1.3) + sw * 2;
      c = mkCanvas(w, h);
      const g = c.getContext('2d');
      g.font = font;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      g.lineWidth = sw;
      g.strokeStyle = strokeColor || '#000';
      g.strokeText(text, w / 2, h / 2);
      g.fillStyle = color;
      g.fillText(text, w / 2, h / 2);
      if (this.map.size > 700) this.map.clear();
      this.map.set(key, c);
      return c;
    }
  }

  class Renderer {
    constructor(canvas, settings) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.settings = settings;
      this.dpr = 1;
      this.w = 0; this.h = 0;
      this.particles = [];
      this.floaters = [];
      this.texts = new TextCache();
      this.skins = new MG.SkinCache();
      this.sprites = {};
      this.biomeSprites = {};
      this.powerSprites = {};
      this.shake = 0;
      this.flash = 0;
      this.flashColor = '255,40,60';
      this.maskCv = mkCanvas(64, 64);
      this.lowQuality = false;
      this.ambient = [];
      this.ambientType = null;
      this.time = 0;
      this.world = null;
      this.me = null;
      this.cloud = null;
      this.resize();
    }

    setLowQuality(v) {
      this.lowQuality = v;
      this.resize();
    }

    resize() {
      const dpr = this.lowQuality ? 1 : Math.min(window.devicePixelRatio || 1, 2);
      this.dpr = dpr;
      this.w = window.innerWidth;
      this.h = window.innerHeight;
      this.cv.width = Math.round(this.w * dpr);
      this.cv.height = Math.round(this.h * dpr);
      this.cv.style.width = this.w + 'px';
      this.cv.style.height = this.h + 'px';
      this.vignette = null;
      this.ambientType = null;
    }

    // Ekran oranına göre temel yakınlaştırma (orijinal oyundaki gibi)
    screenScale() {
      return Math.max(this.h / 1080, this.w / 1920);
    }

    attach(world) {
      this.world = world;
      this.particles.length = 0;
      this.floaters.length = 0;
      this.ambientType = null;
      world.on('eat', e => {
        const c = e.victim;
        this.burst(c.x, c.y, c.owner.color, Math.min(18, 4 + (c.r / 12) | 0), c.r * 0.6);
        if (this.me && e.ep === this.me) this.floatText(e.eater.x, e.eater.y - e.eater.r, '+' + Math.round(c.mass), '#7CFF6B');
        if (this.me && e.vp === this.me) { this.flash = 0.35; this.flashColor = '255,40,60'; }
      });
      world.on('virusPop', e => {
        this.burst(e.x, e.y, { r: 60, g: 255, b: 60, fill: '#33ff33' }, 16, 140);
        this.ring(e.x, e.y, '#33ff33', 30, 260);
        if (this.me && e.player === this.me) this.shake = Math.max(this.shake, 10);
      });
      world.on('meteorImpact', e => {
        const h = e.hazard;
        this.ring(h.x, h.y, '#ff6a2a', h.r * 0.3, h.r * 1.4);
        this.burst(h.x, h.y, { fill: '#ffb347' }, 22, h.r * 0.8);
        if (this.me && this.me.alive && U.dist(h.x, h.y, this.me.cx, this.me.cy) < 1400) this.shake = Math.max(this.shake, 14);
      });
      world.on('teleport', e => {
        this.ring(e.from.x, e.from.y, '#00ffff', 20, 220);
        this.ring(e.to.x, e.to.y, '#00ffff', 20, 220);
      });
      world.on('freeze', e => this.ring(e.x, e.y, '#9be7ff', 40, e.r));
      world.on('power', e => {
        if (!e.player.alive) return;
        const def = MG.POWERUPS[e.type];
        this.ring(e.player.cx, e.player.cy, 'rgb(' + def.color.join(',') + ')', 20, 300);
      });
      world.on('powerup', e => {
        if (this.me && e.player === this.me) {
          const def = MG.POWERUPS[e.type];
          if (def) this.floatText(this.me.cx, this.me.cy - 60, def.icon + ' ' + def.name, '#ffffff');
        }
      });
      world.on('vent', e => this.ring(e.biome.x, e.biome.y, '#ff8a2a', 30, e.biome.r * 1.4));
      world.on('split', e => {
        if (this.settings.reducedMotion) return;
        for (const c of e.player.cells) if (world.time - c.born < 0.05) this.burst(c.x, c.y, e.player.color, 3, c.r * 0.4);
      });
    }

    /* ---- partiküller ---- */
    burst(x, y, color, n, spread) {
      if (this.lowQuality || !this.settings.particles) n = Math.min(n, 3);
      const fill = color.fill || color;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, s = U.rand(0.3, 1) * spread * 2.2;
        this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.rand(0.35, 0.7), max: 0.7, r: U.rand(4, 10), color: fill, type: 'dot' });
      }
      if (this.particles.length > 500) this.particles.splice(0, this.particles.length - 500);
    }
    ring(x, y, color, r0, r1) {
      if (this.particles.length > 500) return;
      this.particles.push({ x, y, r0, r1, life: 0.6, max: 0.6, color, type: 'ring' });
    }
    floatText(x, y, text, color) {
      this.floaters.push({ x, y, text, color, life: 1.2 });
      if (this.floaters.length > 20) this.floaters.shift();
    }

    /* ---- sprite üretimi ---- */
    pelletSprite(idx, glow) {
      const key = idx + (glow ? 'g' : '');
      let s = this.sprites[key];
      if (s) return s;
      const rgb = idx === -1 ? MG.GOLD_COLOR : idx === -2 ? MG.LAVA_COLOR : MG.PELLET_COLORS[idx];
      const R = 20, G = glow ? 16 : 1;
      const size = (R + G) * 2;
      s = mkCanvas(size);
      const g = s.getContext('2d');
      const c = size / 2;
      if (glow) {
        const gr = g.createRadialGradient(c, c, R * 0.6, c, c, R + G);
        gr.addColorStop(0, U.rgba(rgb, 0.55)); gr.addColorStop(1, U.rgba(rgb, 0));
        g.fillStyle = gr; g.fillRect(0, 0, size, size);
      }
      g.beginPath(); g.arc(c, c, R, 0, TAU);
      g.fillStyle = 'rgb(' + rgb.join(',') + ')';
      g.fill();
      if (idx === -1) {
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.beginPath(); g.arc(c - 6, c - 6, 6, 0, TAU); g.fill();
      }
      s.scaleR = (R + G) / R;
      this.sprites[key] = s;
      return s;
    }

    biomeSprite(type) {
      let s = this.biomeSprites[type];
      if (s) return s;
      const def = MG.BIOMES[type];
      s = mkCanvas(256);
      const g = s.getContext('2d');
      const col = def.color;
      const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      const a = type === 'fog' ? 0.0 : type === 'gravity' ? 0.3 : 0.2;
      gr.addColorStop(0, U.rgba(col, a));
      gr.addColorStop(0.7, U.rgba(col, a * 0.6));
      gr.addColorStop(1, U.rgba(col, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      this.biomeSprites[type] = s;
      return s;
    }

    cloudSprite() {
      if (this.cloud) return this.cloud;
      const s = mkCanvas(256);
      const g = s.getContext('2d');
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * TAU, d = Math.random() * 80;
        const x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d, r = U.rand(30, 60);
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(190,190,225,0.35)'); gr.addColorStop(1, 'rgba(190,190,225,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      }
      this.cloud = s;
      return s;
    }

    powerSprite(type) {
      let s = this.powerSprites[type];
      if (s) return s;
      const def = type === 'crown' ? { icon: '👑', color: [255, 210, 60] } : MG.POWERUPS[type];
      s = mkCanvas(128);
      const g = s.getContext('2d');
      const gr = g.createRadialGradient(64, 64, 10, 64, 64, 64);
      gr.addColorStop(0, U.rgba(def.color, 0.95)); gr.addColorStop(0.55, U.rgba(def.color, 0.5)); gr.addColorStop(1, U.rgba(def.color, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      g.beginPath(); g.arc(64, 64, 38, 0, TAU);
      g.fillStyle = 'rgba(10,10,25,0.75)'; g.fill();
      g.lineWidth = 5; g.strokeStyle = 'rgb(' + def.color.join(',') + ')'; g.stroke();
      g.font = '44px ' + MG.EMOJI_FONT;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(def.icon, 64, 68);
      this.powerSprites[type] = s;
      return s;
    }

    /* ---- ana çizim ---- */
    render(world, cam, me, dt) {
      this.time += dt;
      this.me = me;
      const ctx = this.ctx, dpr = this.dpr, W = this.w, H = this.h;
      const arena = world.arena;
      const S = this.settings;

      let sx = 0, sy = 0;
      if (this.shake > 0 && !S.reducedMotion) {
        sx = U.rand(-this.shake, this.shake); sy = U.rand(-this.shake, this.shake);
        this.shake = Math.max(0, this.shake - dt * 40);
      } else this.shake = 0;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = arena.bg;
      ctx.fillRect(0, 0, W, H);
      if (!this.lowQuality && arena.particles) this.drawAmbient(ctx, arena, cam, dt);

      const z = cam.zoom;
      const x0 = cam.x - W / 2 / z, y0 = cam.y - H / 2 / z, x1 = cam.x + W / 2 / z, y1 = cam.y + H / 2 / z;
      ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - cam.x * z + sx), dpr * (H / 2 - cam.y * z + sy));

      if (S.showGrid) this.drawGrid(ctx, world, x0, y0, x1, y1, z);
      this.drawBorder(ctx, world, z);
      if (world.biomes.length) this.drawBiomes(ctx, world, x0, y0, x1, y1, z, false);
      if (world.modeCtl.zone) this.drawZone(ctx, world, z);
      if (world.hazards.length) this.drawHazards(ctx, world, z);
      this.drawPellets(ctx, world, x0, y0, x1, y1, z);
      this.drawEjects(ctx, world, x0, y0, x1, y1);
      this.drawPowerups(ctx, world, x0, y0, x1, y1);
      this.drawBodies(ctx, world, x0, y0, x1, y1, z, me, dt);
      if (world.biomes.length) this.drawBiomes(ctx, world, x0, y0, x1, y1, z, true);
      this.drawParticles(ctx, dt, z);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (world.fx.vision < 0.999) this.drawBlackout(ctx, world, cam, me);
      if (!this.lowQuality && !arena.light) this.drawVignette(ctx);
      if (me && me.alive && me.effects.speed > 0 && !S.reducedMotion) this.drawSpeedLines(ctx);
      if (this.flash > 0) {
        ctx.fillStyle = 'rgba(' + this.flashColor + ',' + (this.flash * 0.5).toFixed(3) + ')';
        ctx.fillRect(0, 0, W, H);
        this.flash = Math.max(0, this.flash - dt * 1.4);
      }
    }

    drawAmbient(ctx, arena, cam, dt) {
      const W = this.w, H = this.h;
      if (this.ambientType !== arena.particles) {
        this.ambientType = arena.particles;
        this.ambient = [];
        const n = arena.particles === 'stars' ? 110 : 55;
        for (let i = 0; i < n; i++) {
          this.ambient.push({ x: Math.random() * W, y: Math.random() * H, s: U.rand(0.3, 1), p: Math.random() * TAU, d: U.rand(0.02, 0.08) });
        }
      }
      const type = this.ambientType;
      const px = cam.x, py = cam.y;
      const lx = this._ambLX === undefined ? px : this._ambLX, ly = this._ambLY === undefined ? py : this._ambLY;
      const mdx = (px - lx) * cam.zoom, mdy = (py - ly) * cam.zoom;
      this._ambLX = px; this._ambLY = py;
      for (const a of this.ambient) {
        a.p += dt;
        a.x -= mdx * a.d; a.y -= mdy * a.d;
        let alpha = 0.5 * a.s;
        switch (type) {
          case 'snow': a.y += (20 + 40 * a.s) * dt; a.x += Math.sin(a.p) * 12 * dt; ctx.fillStyle = 'rgba(230,248,255,' + alpha + ')'; break;
          case 'embers': a.y -= (15 + 35 * a.s) * dt; a.x += Math.sin(a.p * 2) * 8 * dt; alpha *= 0.6 + 0.4 * Math.sin(a.p * 3); ctx.fillStyle = 'rgba(255,' + (90 + ((a.s * 80) | 0)) + ',30,' + alpha + ')'; break;
          case 'bubbles': a.y -= (12 + 25 * a.s) * dt; a.x += Math.sin(a.p) * 10 * dt; ctx.fillStyle = 'rgba(120,200,255,' + alpha * 0.6 + ')'; break;
          case 'stars': alpha = 0.3 + 0.5 * Math.abs(Math.sin(a.p * a.s)); ctx.fillStyle = 'rgba(220,210,255,' + alpha + ')'; break;
          case 'data': a.y += (40 + 80 * a.s) * dt; ctx.fillStyle = 'rgba(255,60,210,' + alpha * 0.6 + ')'; break;
          default: a.x += Math.cos(a.p * 0.3) * 6 * dt; a.y += Math.sin(a.p * 0.3) * 6 * dt; ctx.fillStyle = 'rgba(0,240,255,' + alpha * 0.5 + ')';
        }
        if (a.x < -10) a.x += W + 20; else if (a.x > W + 10) a.x -= W + 20;
        if (a.y < -10) a.y += H + 20; else if (a.y > H + 10) a.y -= H + 20;
        if (type === 'data') ctx.fillRect(a.x, a.y, 2, 10 * a.s + 4);
        else {
          const r = type === 'bubbles' ? 2 + a.s * 4 : type === 'stars' ? a.s * 1.6 : 1 + a.s * 2;
          if (type === 'bubbles') { ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(a.x, a.y, r, 0, TAU); ctx.stroke(); }
          else ctx.fillRect(a.x - r / 2, a.y - r / 2, r, r);
        }
      }
    }

    drawGrid(ctx, world, x0, y0, x1, y1, z) {
      const arena = world.arena;
      let step = 50;
      while (step * z < 7) step *= 2;
      const S = world.size;
      const gx0 = Math.max(0, Math.floor(x0 / step) * step), gy0 = Math.max(0, Math.floor(y0 / step) * step);
      const gx1 = Math.min(S, x1), gy1 = Math.min(S, y1);
      const top = Math.max(0, y0), bot = Math.min(S, y1), left = Math.max(0, x0), right = Math.min(S, x1);
      ctx.beginPath();
      for (let x = gx0; x <= gx1; x += step) { ctx.moveTo(x, top); ctx.lineTo(x, bot); }
      for (let y = gy0; y <= gy1; y += step) { ctx.moveTo(left, y); ctx.lineTo(right, y); }
      ctx.strokeStyle = arena.grid;
      ctx.lineWidth = 1 / z;
      ctx.stroke();
      if (!arena.light && !this.lowQuality) {
        const big = 500;
        ctx.beginPath();
        for (let x = Math.max(0, Math.floor(x0 / big) * big); x <= gx1; x += big) { ctx.moveTo(x, top); ctx.lineTo(x, bot); }
        for (let y = Math.max(0, Math.floor(y0 / big) * big); y <= gy1; y += big) { ctx.moveTo(left, y); ctx.lineTo(right, y); }
        ctx.lineWidth = 2 / z;
        ctx.stroke();
      }
    }

    drawBorder(ctx, world, z) {
      const S = world.size, a = world.arena;
      if (!a.light && !this.lowQuality) {
        ctx.strokeStyle = a.border;
        ctx.globalAlpha = 0.18;
        ctx.lineWidth = 40 / z + 20;
        ctx.strokeRect(0, 0, S, S);
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = a.border;
      ctx.lineWidth = Math.max(4, 3 / z);
      ctx.strokeRect(0, 0, S, S);
    }

    drawBiomes(ctx, world, x0, y0, x1, y1, z, overlay) {
      const t = this.time;
      for (const b of world.biomes) {
        if (b.x + b.r < x0 || b.x - b.r > x1 || b.y + b.r < y0 || b.y - b.r > y1) continue;
        const col = b.def.color;
        if (overlay) {
          if (b.type === 'fog') {
            const cl = this.cloudSprite();
            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.rotate(t * 0.02);
            ctx.globalAlpha = 0.85;
            ctx.drawImage(cl, -b.r * 1.15, -b.r * 1.15, b.r * 2.3, b.r * 2.3);
            ctx.rotate(-t * 0.05);
            ctx.globalAlpha = 0.6;
            ctx.drawImage(cl, -b.r, -b.r, b.r * 2, b.r * 2);
            ctx.restore();
            ctx.globalAlpha = 1;
          }
          continue;
        }
        if (b.type !== 'wormhole' && b.type !== 'fog') {
          const sp = this.biomeSprite(b.type);
          ctx.drawImage(sp, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
        }
        ctx.lineWidth = 3 / z + 2;
        switch (b.type) {
          case 'gravity': {
            ctx.save(); ctx.translate(b.x, b.y);
            for (let arm = 0; arm < 4; arm++) {
              ctx.beginPath();
              for (let i = 0; i <= 30; i++) {
                const k = i / 30, a = arm * (TAU / 4) + k * 4 - t * 1.2;
                const d = b.core + k * (b.r * 0.9 - b.core);
                const px = Math.cos(a) * d, py = Math.sin(a) * d;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
              }
              ctx.strokeStyle = U.rgba(col, 0.35);
              ctx.lineWidth = 10;
              ctx.stroke();
            }
            const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, b.core * 1.4);
            cg.addColorStop(0, 'rgba(0,0,0,1)'); cg.addColorStop(0.7, 'rgba(10,0,30,0.95)'); cg.addColorStop(1, U.rgba(col, 0));
            ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, b.core * 1.4, 0, TAU); ctx.fill();
            ctx.strokeStyle = U.rgba([200, 150, 255], 0.9); ctx.lineWidth = 6;
            ctx.beginPath(); ctx.arc(0, 0, b.core, 0, TAU); ctx.stroke();
            ctx.restore();
            break;
          }
          case 'wormhole': {
            ctx.save(); ctx.translate(b.x, b.y);
            for (let i = 0; i < 4; i++) {
              ctx.rotate(t * (1 + i * 0.4) * (i % 2 ? -1 : 1) * 0.5);
              ctx.beginPath(); ctx.arc(0, 0, b.r * (1 - i * 0.2), 0, TAU * 0.7);
              ctx.strokeStyle = i % 2 ? 'rgba(255,0,255,0.7)' : 'rgba(0,255,255,0.8)';
              ctx.lineWidth = 8; ctx.stroke();
            }
            ctx.restore();
            const gg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
            gg.addColorStop(0, 'rgba(255,255,255,0.8)'); gg.addColorStop(0.5, 'rgba(0,200,255,0.25)'); gg.addColorStop(1, 'rgba(0,200,255,0)');
            ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
            break;
          }
          case 'current': case 'speed': {
            const ang = b.type === 'current' ? b.angle : t * 0.2;
            ctx.strokeStyle = U.rgba(col, 0.35);
            ctx.lineWidth = 12;
            const sp = 220, off = (t * (b.type === 'current' ? 90 : 160)) % sp;
            ctx.save();
            ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.95, 0, TAU); ctx.clip();
            ctx.translate(b.x, b.y); ctx.rotate(ang);
            ctx.beginPath();
            for (let yy = -b.r; yy <= b.r; yy += 200) {
              for (let xx = -b.r - sp; xx <= b.r; xx += sp) {
                const X = xx + off;
                ctx.moveTo(X - 40, yy - 40); ctx.lineTo(X, yy); ctx.lineTo(X - 40, yy + 40);
              }
            }
            ctx.stroke();
            ctx.restore();
            break;
          }
          case 'ice': {
            ctx.strokeStyle = 'rgba(210,245,255,0.18)'; ctx.lineWidth = 4;
            ctx.save(); ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.clip();
            ctx.beginPath();
            for (let i = -6; i <= 6; i++) {
              ctx.moveTo(b.x + i * 160 - b.r, b.y - b.r); ctx.lineTo(b.x + i * 160 + b.r, b.y + b.r);
              ctx.moveTo(b.x + i * 160 + b.r, b.y - b.r); ctx.lineTo(b.x + i * 160 - b.r, b.y + b.r);
            }
            ctx.stroke(); ctx.restore();
            break;
          }
          case 'lava': {
            for (let i = 0; i < 7; i++) {
              const a = i * 0.9 + b.x, pulse = (t * 0.6 + i * 0.37) % 1;
              const d = b.r * (0.2 + ((i * 37) % 60) / 100);
              ctx.fillStyle = 'rgba(255,' + (120 + i * 12) + ',30,' + (0.35 * (1 - pulse)) + ')';
              ctx.beginPath(); ctx.arc(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, 30 + pulse * 60, 0, TAU); ctx.fill();
            }
            break;
          }
          case 'vent': {
            const pulse = 0.5 + 0.5 * Math.sin(t * 3);
            ctx.fillStyle = 'rgba(255,120,20,' + (0.25 + pulse * 0.25) + ')';
            ctx.beginPath(); ctx.arc(b.x, b.y, 70 + pulse * 20, 0, TAU); ctx.fill();
            ctx.fillStyle = 'rgba(40,10,5,0.9)';
            ctx.beginPath(); ctx.arc(b.x, b.y, 45, 0, TAU); ctx.fill();
            break;
          }
          case 'nebula': {
            for (let i = 0; i < 10; i++) {
              const a = i * 2.39996 + t * 0.05, d = b.r * (0.15 + (i / 10) * 0.75);
              const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + i));
              ctx.fillStyle = 'rgba(255,230,140,' + (0.5 * tw) + ')';
              const px = b.x + Math.cos(a) * d, py = b.y + Math.sin(a) * d;
              ctx.beginPath(); ctx.moveTo(px, py - 18); ctx.lineTo(px + 5, py); ctx.lineTo(px, py + 18); ctx.lineTo(px - 5, py); ctx.closePath(); ctx.fill();
            }
            break;
          }
        }
        if (b.type !== 'wormhole') {
          ctx.setLineDash([30, 24]);
          ctx.strokeStyle = U.rgba(col, b.type === 'fog' ? 0.25 : 0.4);
          ctx.lineWidth = 3 / z + 2;
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke();
          ctx.setLineDash([]);
        }
        if (z > 0.18 && b.type !== 'fog') {
          const px = qpx(Math.min(26, Math.max(12, 150 * z * 0.12)) * this.dpr);
          const tx = this.texts.get(b.def.icon + ' ' + b.def.name, px, U.rgba(col, 0.9), 'rgba(0,0,0,0.6)');
          const s = 1 / (z * this.dpr);
          const yy = b.type === 'wormhole' ? b.y - b.r - 30 / z : b.y - b.r + 40 / z;
          ctx.globalAlpha = 0.75;
          ctx.drawImage(tx, b.x - (tx.width * s) / 2, yy - (tx.height * s) / 2, tx.width * s, tx.height * s);
          ctx.globalAlpha = 1;
        }
      }
    }

    drawZone(ctx, world, z) {
      const zn = world.modeCtl.zone;
      const S = world.size;
      ctx.beginPath();
      ctx.rect(-S, -S, S * 3, S * 3);
      ctx.arc(zn.x, zn.y, zn.r, 0, TAU, true);
      ctx.fillStyle = zn.state === 'shrink' ? 'rgba(255,20,70,0.22)' : 'rgba(255,40,90,0.14)';
      ctx.fill();
      ctx.lineWidth = 8 / z;
      ctx.strokeStyle = 'rgba(255,60,110,0.95)';
      ctx.beginPath(); ctx.arc(zn.x, zn.y, zn.r, 0, TAU); ctx.stroke();
      if (zn.state === 'wait') {
        ctx.setLineDash([40 / z, 30 / z]);
        ctx.lineWidth = 4 / z;
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath(); ctx.arc(zn.toX, zn.toY, zn.toR, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    drawHazards(ctx, world, z) {
      const now = world.time;
      for (const h of world.hazards) {
        if (h.done) continue;
        const k = U.clamp((now - h.born) / (h.impactAt - h.born), 0, 1);
        const pulse = 0.5 + 0.5 * Math.sin(now * 14);
        ctx.fillStyle = 'rgba(255,50,40,' + (0.12 + k * 0.2) + ')';
        ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.fill();
        ctx.lineWidth = 6 / z + 3;
        ctx.strokeStyle = 'rgba(255,70,50,' + (0.5 + pulse * 0.5) + ')';
        ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(255,120,60,0.35)';
        ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.arc(h.x, h.y, h.r, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.closePath(); ctx.fill();
        // düşen meteor
        const mx = h.x + (1 - k) * 600, my = h.y - (1 - k) * 900;
        const gr = ctx.createRadialGradient(mx, my, 0, mx, my, 60);
        gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.4, 'rgba(255,140,40,0.9)'); gr.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(mx, my, 60, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,160,60,0.5)'; ctx.lineWidth = 24;
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + 180, my - 270); ctx.stroke();
      }
    }

    drawPellets(ctx, world, x0, y0, x1, y1, z) {
      const glow = world.arena.pelletGlow && !this.lowQuality && z > 0.2;
      const store = world.pellets;
      const cs = store.cs, cols = store.cols;
      let bx0 = Math.max(0, (x0 / cs) | 0), by0 = Math.max(0, (y0 / cs) | 0);
      let bx1 = Math.min(cols - 1, (x1 / cs) | 0), by1 = Math.min(cols - 1, (y1 / cs) | 0);
      if (x1 < 0 || y1 < 0) return;
      const spr = [];
      for (let by = by0; by <= by1; by++) {
        for (let bx = bx0; bx <= bx1; bx++) {
          const b = store.buckets[by * cols + bx];
          for (let i = 0; i < b.length; i++) {
            const p = b[i];
            const key = p.c + 2;
            let s = spr[key];
            if (!s) s = spr[key] = this.pelletSprite(p.c, glow || p.gold);
            const R = p.r * s.scaleR;
            ctx.drawImage(s, p.x - R, p.y - R, R * 2, R * 2);
          }
        }
      }
    }

    drawEjects(ctx, world, x0, y0, x1, y1) {
      for (const e of world.ejects) {
        if (e.x + e.r < x0 || e.x - e.r > x1 || e.y + e.r < y0 || e.y - e.r > y1) continue;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, TAU);
        ctx.fillStyle = e.color.fill;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = e.color.stroke;
        ctx.stroke();
      }
    }

    drawPowerups(ctx, world, x0, y0, x1, y1) {
      const t = this.time;
      for (const pu of world.powerups) {
        if (pu.dead) continue;
        const R = pu.r * 2.1;
        if (pu.x + R < x0 || pu.x - R > x1 || pu.y + R < y0 || pu.y - R > y1) continue;
        const bob = Math.sin(t * 3 + pu.seed) * 6;
        const pulse = 1 + Math.sin(t * 4 + pu.seed) * 0.06;
        const s = this.powerSprite(pu.type);
        const rr = R * pulse;
        ctx.drawImage(s, pu.x - rr, pu.y - rr + bob, rr * 2, rr * 2);
        if (pu.type === 'crown') {
          ctx.strokeStyle = 'rgba(255,215,60,' + (0.4 + 0.3 * Math.sin(t * 5)) + ')';
          ctx.lineWidth = 6;
          ctx.beginPath(); ctx.arc(pu.x, pu.y, R * 1.4 + Math.sin(t * 3) * 10, 0, TAU); ctx.stroke();
        }
      }
    }

    drawBodies(ctx, world, x0, y0, x1, y1, z, me, dt) {
      const list = this._bodies || (this._bodies = []);
      list.length = 0;
      const k = Math.min(1, dt * 12);
      for (const c of world.cells) {
        c.renderR += (c.r - c.renderR) * k;
        const r = c.renderR;
        if (c.x + r < x0 || c.x - r > x1 || c.y + r < y0 || c.y - r > y1) continue;
        if (me && world.isHiddenFrom(c, me)) continue;
        list.push(c);
      }
      for (const v of world.viruses) {
        v.renderR += (v.r - v.renderR) * k;
        if (v.x + v.r < x0 || v.x - v.r > x1 || v.y + v.r < y0 || v.y - v.r > y1) continue;
        list.push(v);
      }
      for (const m of world.mothers) {
        if (m.x + m.r < x0 || m.x - m.r > x1 || m.y + m.r < y0 || m.y - m.r > y1) continue;
        list.push(m);
      }
      list.sort((a, b) => (a.renderR || a.r) - (b.renderR || b.r));
      const crownHolder = world.modeCtl.holder || null;
      for (const b of list) {
        if (b.kind === K.CELL) this.drawCell(ctx, world, b, z, me, crownHolder);
        else if (b.kind === K.VIRUS) this.drawVirus(ctx, b, z);
        else this.drawMother(ctx, b, z);
      }
    }

    cellPath(ctx, c, r, z) {
      const S = this.settings;
      const screenR = r * z;
      if (!S.jelly || this.lowQuality || screenR < 22) {
        ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU);
        return;
      }
      const n = Math.min(90, Math.max(24, (screenR * 0.5) | 0));
      const t = this.time;
      const sp = Math.sqrt(c.mvx * c.mvx + c.mvy * c.mvy);
      const amp = Math.min(0.035, 0.008 + sp / 30000) * r;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * TAU;
        const w = Math.sin(a * 3 + t * 3 + c.seed) * 0.6 + Math.sin(a * 5 - t * 2.3 + c.seed * 2) * 0.4;
        const rr = r + w * amp;
        const px = c.x + Math.cos(a) * rr, py = c.y + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }

    drawCell(ctx, world, c, z, me, crownHolder) {
      const S = this.settings;
      const o = c.owner;
      const r = c.renderR;
      const t = this.time;
      const ghost = o.effects.ghost > 0;
      if (ghost) ctx.globalAlpha = 0.45;
      if (o.isBoss && !this.lowQuality) {
        const gr = ctx.createRadialGradient(c.x, c.y, r * 0.8, c.x, c.y, r * 1.35);
        gr.addColorStop(0, 'rgba(160,60,255,0.45)'); gr.addColorStop(1, 'rgba(160,60,255,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(c.x, c.y, r * 1.35, 0, TAU); ctx.fill();
      }
      this.cellPath(ctx, c, r, z);
      ctx.fillStyle = o.color.fill;
      ctx.fill();
      const skin = S.showSkins && o.skin !== 'none' ? this.skins.get(o.skin, o.color) : null;
      if (skin) {
        ctx.save();
        ctx.clip();
        if (skin.fullBleed) ctx.drawImage(skin, c.x - r, c.y - r, r * 2, r * 2);
        else ctx.drawImage(skin, c.x - r * 0.8, c.y - r * 0.8, r * 1.6, r * 1.6);
        ctx.restore();
        this.cellPath(ctx, c, r, z);
      }
      ctx.lineWidth = Math.max(2 / z, Math.min(r * 0.075, 16));
      ctx.strokeStyle = o.color.stroke;
      ctx.stroke();
      if (o.effects.frozen > 0) {
        ctx.fillStyle = 'rgba(170,235,255,0.35)';
        ctx.fill();
        ctx.lineWidth = 4 / z + 2; ctx.strokeStyle = 'rgba(200,245,255,0.9)'; ctx.stroke();
      }
      ctx.globalAlpha = 1;

      if (o.effects.shield > 0) {
        const pulse = 1 + Math.sin(t * 6) * 0.03;
        ctx.beginPath(); ctx.arc(c.x, c.y, r * 1.12 * pulse + 6, 0, TAU);
        ctx.strokeStyle = 'rgba(90,210,255,0.85)'; ctx.lineWidth = 5 / z + 3; ctx.stroke();
        ctx.fillStyle = 'rgba(90,210,255,0.12)'; ctx.fill();
      }
      if (o.effects.magnet > 0 && o === me) {
        ctx.setLineDash([12 / z, 12 / z]);
        ctx.beginPath(); ctx.arc(c.x, c.y, r + 380, 0, TAU);
        ctx.strokeStyle = 'rgba(255,80,100,0.35)'; ctx.lineWidth = 2 / z; ctx.stroke();
        ctx.setLineDash([]);
      }
      if (o.effects.speed > 0 && S.particles && !this.lowQuality && Math.random() < 0.5) {
        this.particles.push({ x: c.x - c.mvx * 0.05, y: c.y - c.mvy * 0.05, vx: -c.mvx * 0.2, vy: -c.mvy * 0.2, life: 0.35, max: 0.35, r: Math.max(6, r * 0.25), color: 'rgba(255,230,0,0.6)', type: 'dot' });
      }

      const screenR = r * z * this.dpr;
      const wpp = 1 / (z * this.dpr);
      if (S.showNames && o.name && screenR > 14) {
        const ideal = screenR * 0.34;
        const px = qpx(ideal);
        const tx = this.texts.get(o.name, px, '#ffffff');
        const s = (ideal / px) * wpp;
        ctx.drawImage(tx, c.x - (tx.width * s) / 2, c.y - (tx.height * s) / 2, tx.width * s, tx.height * s);
      }
      if (S.showMass && o === me && screenR > 14) {
        const ideal = screenR * 0.22;
        const px = qpx(ideal);
        const tx = this.texts.get(String(Math.floor(c.mass)), px, '#ffffff');
        const s = (ideal / px) * wpp;
        const yoff = S.showNames && o.name ? r * 0.36 : 0;
        ctx.drawImage(tx, c.x - (tx.width * s) / 2, c.y + yoff - (tx.height * s) / 2, tx.width * s, tx.height * s);
      }
      if ((o === crownHolder || o.isRival || o.isBoss) && (o.cells.length === 1 || c === o.biggest())) {
        const icon = o === crownHolder ? '👑' : o.isBoss ? '👾' : '⚔️';
        const ideal = Math.max(18, screenR * 0.45);
        const px = qpx(ideal);
        const tx = this.texts.get(icon, px, '#fff', 'rgba(0,0,0,0)');
        const s = (ideal / px) * wpp;
        const bob = Math.sin(t * 3) * r * 0.04;
        ctx.drawImage(tx, c.x - (tx.width * s) / 2, c.y - r - (tx.height * s) * 0.55 + bob, tx.width * s, tx.height * s);
      }
    }

    drawVirus(ctx, v, z) {
      const r = v.renderR;
      const t = this.time;
      const spikes = Math.max(18, Math.round(r / 4.2));
      const rot = t * 0.15 + v.seed;
      ctx.beginPath();
      for (let i = 0; i <= spikes * 2; i++) {
        const a = rot + (i / (spikes * 2)) * TAU;
        const rr = i % 2 ? r * 1.06 : r * 0.94;
        const px = v.x + Math.cos(a) * rr, py = v.y + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      if (v.temp) { ctx.fillStyle = 'rgba(190,60,255,0.85)'; ctx.strokeStyle = '#8a1fd1'; }
      else { ctx.fillStyle = 'rgba(51,255,51,0.9)'; ctx.strokeStyle = '#19d119'; }
      ctx.fill();
      ctx.lineWidth = Math.max(3, 5 / Math.max(z, 0.3));
      ctx.stroke();
      if (v.feeds > 0) {
        ctx.beginPath();
        ctx.arc(v.x, v.y, r * 0.55, -Math.PI / 2, -Math.PI / 2 + TAU * (v.feeds / MG.CFG.VIRUS_FEEDS));
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 8; ctx.stroke();
      }
    }

    drawMother(ctx, m, z) {
      const t = this.time;
      const r = m.r * (1 + Math.sin(t * 2 + m.seed) * 0.03);
      const spikes = 30;
      ctx.beginPath();
      for (let i = 0; i <= spikes * 2; i++) {
        const a = -t * 0.2 + (i / (spikes * 2)) * TAU;
        const rr = i % 2 ? r * 1.08 : r * 0.95;
        const px = m.x + Math.cos(a) * rr, py = m.y + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = '#ce6363';
      ctx.fill();
      ctx.strokeStyle = '#a54747';
      ctx.lineWidth = Math.max(3, 5 / Math.max(z, 0.3));
      ctx.stroke();
    }

    drawParticles(ctx, dt, z) {
      const ps = this.particles;
      let w = 0;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        p.life -= dt;
        if (p.life <= 0) continue;
        ps[w++] = p;
        const k = p.life / p.max;
        if (p.type === 'ring') {
          const rr = U.lerp(p.r1, p.r0, k);
          ctx.globalAlpha = k * 0.8;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 6 / z + 2;
          ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, TAU); ctx.stroke();
        } else {
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.vx *= 0.92; p.vy *= 0.92;
          ctx.globalAlpha = k;
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + k * 0.5), 0, TAU); ctx.fill();
        }
      }
      ps.length = w;
      ctx.globalAlpha = 1;
      const fl = this.floaters;
      for (let i = fl.length - 1; i >= 0; i--) {
        const f = fl[i];
        f.life -= dt;
        if (f.life <= 0) { fl.splice(i, 1); continue; }
        f.y -= 60 * dt / z;
        const px = qpx(22 * this.dpr);
        const tx = this.texts.get(f.text, px, f.color);
        const s = 1 / (z * this.dpr);
        ctx.globalAlpha = Math.min(1, f.life * 2);
        ctx.drawImage(tx, f.x - (tx.width * s) / 2, f.y - (tx.height * s) / 2, tx.width * s, tx.height * s);
      }
      ctx.globalAlpha = 1;
    }

    drawBlackout(ctx, world, cam, me) {
      const W = this.w, H = this.h;
      const k = 1 - world.fx.vision;
      const scale = 0.25;
      const mw = Math.max(1, Math.round(W * scale)), mh = Math.max(1, Math.round(H * scale));
      const m = this.maskCv;
      if (m.width !== mw || m.height !== mh) { m.width = mw; m.height = mh; }
      const g = m.getContext('2d');
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, mw, mh);
      g.fillStyle = 'rgba(0,0,0,' + Math.min(0.96, k * 1.75) + ')';
      g.fillRect(0, 0, mw, mh);
      g.globalCompositeOperation = 'destination-out';
      const holes = me && me.alive ? me.cells : [{ x: cam.x, y: cam.y, r: 60 }];
      for (const c of holes) {
        const sx = (W / 2 + (c.x - cam.x) * cam.zoom) * scale;
        const sy = (H / 2 + (c.y - cam.y) * cam.zoom) * scale;
        const R = (c.r * cam.zoom + 330 * cam.zoom + 60) * scale;
        const gr = g.createRadialGradient(sx, sy, R * 0.35, sx, sy, R);
        gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(sx, sy, R, 0, TAU); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(m, 0, 0, W, H);
    }

    drawVignette(ctx) {
      const W = this.w, H = this.h;
      if (!this.vignette) {
        const c = mkCanvas(256);
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(128, 128, 80, 128, 128, 182);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.45)');
        g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
        this.vignette = c;
      }
      ctx.drawImage(this.vignette, 0, 0, W, H);
    }

    drawSpeedLines(ctx) {
      const W = this.w, H = this.h;
      ctx.strokeStyle = 'rgba(255,240,120,0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * TAU, d0 = Math.max(W, H) * U.rand(0.35, 0.5);
        ctx.moveTo(W / 2 + Math.cos(a) * d0, H / 2 + Math.sin(a) * d0);
        ctx.lineTo(W / 2 + Math.cos(a) * (d0 + 120), H / 2 + Math.sin(a) * (d0 + 120));
      }
      ctx.stroke();
    }

    /* ---- mini harita ---- */
    drawMinimap(mc, world, me, cam) {
      const g = mc.getContext('2d');
      const size = mc.width;
      const S = world.size, k = size / S;
      const light = world.arena.light;
      g.clearRect(0, 0, size, size);
      g.fillStyle = light ? 'rgba(0,0,0,0.12)' : 'rgba(5,5,20,0.55)';
      g.fillRect(0, 0, size, size);
      g.strokeStyle = light ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)';
      g.lineWidth = 1;
      const sec = size / 5;
      g.beginPath();
      for (let i = 1; i < 5; i++) { g.moveTo(i * sec, 0); g.lineTo(i * sec, size); g.moveTo(0, i * sec); g.lineTo(size, i * sec); }
      g.stroke();
      for (const b of world.biomes) {
        g.fillStyle = U.rgba(b.def.color, b.type === 'gravity' ? 0.5 : 0.28);
        g.beginPath(); g.arc(b.x * k, b.y * k, Math.max(2, b.r * k), 0, TAU); g.fill();
      }
      const zn = world.modeCtl.zone;
      if (zn) {
        g.strokeStyle = 'rgba(255,60,110,0.95)'; g.lineWidth = 2;
        g.beginPath(); g.arc(zn.x * k, zn.y * k, zn.r * k, 0, TAU); g.stroke();
        if (zn.state === 'wait') {
          g.setLineDash([4, 3]); g.strokeStyle = 'rgba(255,255,255,0.8)';
          g.beginPath(); g.arc(zn.toX * k, zn.toY * k, zn.toR * k, 0, TAU); g.stroke(); g.setLineDash([]);
        }
      }
      for (const e of world.events.active) {
        if (e.id === 'food_rain' && e.data) {
          g.fillStyle = 'rgba(255,220,80,' + (0.25 + 0.15 * Math.sin(this.time * 4)) + ')';
          g.beginPath(); g.arc(e.data.x * k, e.data.y * k, e.data.r * k, 0, TAU); g.fill();
        }
      }
      for (const h of world.hazards) {
        if (h.done) continue;
        g.fillStyle = 'rgba(255,60,40,0.9)';
        g.beginPath(); g.arc(h.x * k, h.y * k, 2.5, 0, TAU); g.fill();
      }
      for (const pu of world.powerups) {
        if (pu.type !== 'crown') continue;
        g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(pu.x * k, pu.y * k, 4, 0, TAU); g.fill();
      }
      const holder = world.modeCtl.holder;
      for (const p of world.players) {
        if (!p.alive || p === me) continue;
        let col = null, rad = 3;
        if (p === holder) { col = '#ffd23f'; rad = 4.5; }
        else if (p.isBoss) { col = '#b04dff'; rad = 5; }
        else if (me && p.team && p.team === me.team) col = p.color.fill;
        else if (me && me.alive && p.isAlly(me, world.time)) col = '#7CFF6B';
        if (!col) continue;
        g.fillStyle = col;
        g.beginPath(); g.arc(p.cx * k, p.cy * k, rad, 0, TAU); g.fill();
      }
      if (me && me.alive) {
        for (const c of me.cells) {
          g.fillStyle = me.color.fill;
          g.beginPath(); g.arc(c.x * k, c.y * k, Math.max(2.5, c.r * k), 0, TAU); g.fill();
        }
        g.strokeStyle = '#fff'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(me.cx * k, me.cy * k, Math.max(4, Math.sqrt(me.totalMass * 100) * k + 2), 0, TAU); g.stroke();
      }
      const vw = this.w / cam.zoom, vh = this.h / cam.zoom;
      g.strokeStyle = light ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.3)';
      g.lineWidth = 1;
      g.strokeRect((cam.x - vw / 2) * k, (cam.y - vh / 2) * k, vw * k, vh * k);
    }
  }

  MG.Renderer = Renderer;
  MG.FONT = FONT;
})(window.MG = window.MG || {});
