/* MAGGAR.io — mod kuralları: Klasik, Takımlar, Son Hücre (BR), Taç Avı */
(function (MG) {
  'use strict';
  const U = MG.U;

  class BaseCtl {
    constructor(w) { this.w = w; this.zone = null; }
    init() {}
    update() {}
    canRespawn() { return !!this.w.mode.respawn; }
    assignTeam() { return 0; }
    hud() { return null; }
  }

  class TeamsCtl extends BaseCtl {
    assignTeam() {
      const counts = [0, 0, 0, 0];
      for (const p of this.w.players) if (p.team) counts[p.team]++;
      let best = 1;
      for (let t = 2; t <= 3; t++) if (counts[t] < counts[best]) best = t;
      return best;
    }
  }

  const BR_PHASES = [
    { wait: 40, shrink: 25, f: 0.62 },
    { wait: 30, shrink: 22, f: 0.6 },
    { wait: 25, shrink: 20, f: 0.55 },
    { wait: 20, shrink: 18, f: 0.5 },
    { wait: 18, shrink: 18, f: 0.45 },
    { wait: 15, shrink: 25, f: 0.3 }
  ];

  class RoyaleCtl extends BaseCtl {
    constructor(w) {
      super(w);
      const S = w.size;
      this.zone = { x: S / 2, y: S / 2, r: S * 0.72, fromX: 0, fromY: 0, fromR: 0, toX: S / 2, toY: S / 2, toR: S * 0.72, state: 'wait', t: BR_PHASES[0].wait, total: BR_PHASES[0].wait, phase: 0 };
      this.elapsed = 0;
      this.finished = false;
      this.placements = [];
      this.finalTimer = 0;
      this.startCount = 0;
      this.planNext();
    }
    planNext() {
      const z = this.zone, ph = BR_PHASES[z.phase];
      if (!ph) return;
      const newR = Math.max(140, z.r * ph.f);
      const maxOff = Math.max(0, z.r - newR) * 0.85;
      const a = Math.random() * U.TAU, d = Math.random() * maxOff;
      z.toX = U.clamp(z.x + Math.cos(a) * d, newR * 0.3, this.w.size - newR * 0.3);
      z.toY = U.clamp(z.y + Math.sin(a) * d, newR * 0.3, this.w.size - newR * 0.3);
      z.toR = newR;
    }
    update(dt) {
      if (this.finished) return;
      const w = this.w, z = this.zone;
      this.elapsed += dt;
      z.t -= dt;
      if (z.state === 'wait' && z.t <= 0) {
        const ph = BR_PHASES[z.phase];
        if (ph) {
          z.state = 'shrink'; z.t = ph.shrink; z.total = ph.shrink;
          z.fromX = z.x; z.fromY = z.y; z.fromR = z.r;
          w.emit('zone', { state: 'shrink', phase: z.phase });
        } else {
          z.state = 'final'; z.t = 60; z.total = 60;
        }
      } else if (z.state === 'shrink') {
        const k = U.clamp(1 - z.t / z.total, 0, 1);
        z.x = U.lerp(z.fromX, z.toX, k); z.y = U.lerp(z.fromY, z.toY, k); z.r = U.lerp(z.fromR, z.toR, k);
        if (z.t <= 0) {
          z.phase++;
          const ph = BR_PHASES[z.phase];
          if (ph) { z.state = 'wait'; z.t = ph.wait; z.total = ph.wait; this.planNext(); }
          else { z.state = 'final'; z.t = 60; z.total = 60; }
          w.emit('zone', { state: z.state, phase: z.phase });
        }
      } else if (z.state === 'final' && z.t <= 0) {
        // Süre doldu: en büyük hücre kazanır
        const alive = w.alivePlayers().sort((a, b) => b.totalMass - a.totalMass);
        this.finish(alive[0] || null);
        return;
      }
      // Alan dışı hasar
      const mul = 1 + z.phase * 0.25;
      for (const c of w.cells) {
        if (c.dead) continue;
        const dx = c.x - z.x, dy = c.y - z.y;
        if (dx * dx + dy * dy > z.r * z.r) {
          c.setMass(c.mass - Math.max(c.mass * 0.045, 2.5) * mul * dt);
          if (c.mass < 9) { c.dead = true; c.owner.deathCause = 'zone'; }
        }
      }
      if (this.elapsed > 3) {
        let alive = 0, last = null;
        for (const p of w.players) if (p.alive) { alive++; last = p; }
        if (alive <= 1) this.finish(last);
      }
    }
    onDeath(p) {
      p.eliminated = true;
      let alive = 0;
      for (const q of this.w.players) if (q.alive) alive++;
      p.placement = alive + 1;
      this.placements.unshift(p);
    }
    finish(winner) {
      if (this.finished) return;
      this.finished = true;
      if (winner) { winner.placement = 1; this.placements.unshift(winner); }
      this.w.over = true;
      this.w.result = { mode: 'royale', winner, placements: this.placements.slice() };
      this.w.emit('matchEnd', this.w.result);
    }
    canRespawn() { return false; }
    hud() {
      const z = this.zone;
      let alive = 0;
      for (const p of this.w.players) if (p.alive) alive++;
      let label;
      const t = U.formatTime(z.t);
      if (z.state === 'wait') label = MG.t('ui.zoneWait', { t });
      else if (z.state === 'shrink') label = MG.t('ui.zoneShrink', { t });
      else label = MG.t('ui.zoneFinal', { t });
      return { type: 'royale', alive, label, danger: z.state === 'shrink' };
    }
  }

  class CrownCtl extends BaseCtl {
    constructor(w) {
      super(w);
      this.holder = null;
      this.orb = null;
      this.remaining = w.mode.duration || 300;
      this.finished = false;
    }
    init() { this.dropCrown(this.w.size / 2, this.w.size / 2); }
    dropCrown(x, y) {
      const pu = this.w.spawnPowerUp('crown', U.clamp(x, 100, this.w.size - 100), U.clamp(y, 100, this.w.size - 100));
      pu.temp = true;
      this.orb = pu;
      this.holder = null;
      this.w.emit('crown', { player: null, dropped: true, x, y });
    }
    onCrownPickup(p) {
      this.holder = p;
      this.orb = null;
      this.w.emit('crown', { player: p });
    }
    onDeath(p, killer) {
      if (p !== this.holder) return;
      if (killer && killer.alive) { this.holder = killer; this.w.emit('crown', { player: killer, stolen: true, from: p }); }
      else this.dropCrown(p.cx, p.cy);
    }
    update(dt) {
      if (this.finished) return;
      this.remaining -= dt;
      const h = this.holder;
      if (h) {
        if (!h.alive) this.dropCrown(h.cx, h.cy);
        else h.crownPoints += dt;
      } else if (!this.orb || this.orb.dead) {
        this.dropCrown(this.w.size / 2, this.w.size / 2);
      }
      if (this.remaining <= 0) this.finish();
    }
    finish() {
      this.finished = true;
      const standings = this.w.players.filter(p => !p.isBoss).sort((a, b) => b.crownPoints - a.crownPoints || b.totalMass - a.totalMass);
      standings.forEach((p, i) => { p.placement = i + 1; });
      this.w.over = true;
      this.w.result = { mode: 'crown', winner: standings[0] || null, placements: standings };
      this.w.emit('matchEnd', this.w.result);
    }
    speedMul(p) { return p === this.holder ? 0.9 : 1; }
    hud() {
      return { type: 'crown', remaining: this.remaining, holder: this.holder, label: MG.t('ui.timeLeft', { t: U.formatTime(this.remaining) }) };
    }
  }

  MG.createModeController = function (w) {
    if (w.mode.zone) return new RoyaleCtl(w);
    if (w.mode.crown) return new CrownCtl(w);
    if (w.mode.teams) return new TeamsCtl(w);
    return new BaseCtl(w);
  };
})(window.MG = window.MG || {});
