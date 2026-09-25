/* MAGGAR.io — sürekli değişen dünya olayları */
(function (MG) {
  'use strict';
  const U = MG.U;

  const H = {
    food_rain: {
      start(w, e) {
        const h = w.human && w.human.alive ? w.human : null;
        let x, y;
        if (h && Math.random() < 0.5) {
          const a = Math.random() * U.TAU;
          x = U.clamp(h.cx + Math.cos(a) * U.rand(900, 2200), 1500, w.size - 1500);
          y = U.clamp(h.cy + Math.sin(a) * U.rand(900, 2200), 1500, w.size - 1500);
        } else {
          const p = w.randomPoint(1800); x = p.x; y = p.y;
        }
        e.data = { x, y, r: Math.min(2200, w.size * 0.22), acc: 0 };
      },
      update(w, e, dt) {
        const d = e.data;
        if (w.pellets.count > w.targets.pellets * 1.7) return;
        d.acc += 95 * dt;
        while (d.acc >= 1) {
          d.acc--;
          const a = Math.random() * U.TAU, r = Math.sqrt(Math.random()) * d.r;
          w.spawnPellet(U.clamp(d.x + Math.cos(a) * r, 10, w.size - 10), U.clamp(d.y + Math.sin(a) * r, 10, w.size - 10), U.chance(0.3) ? 2 : 1);
        }
      }
    },
    golden: {
      start(w) {
        for (let i = 0; i < 160; i++) w.spawnPellet(undefined, undefined, 5, true);
      },
      apply(w, e, fx) { fx.goldChance = 0.3; }
    },
    virus_storm: {
      start(w, e) {
        const until = w.time + e.duration;
        for (let i = 0; i < 16; i++) {
          const v = w.spawnVirus(undefined, undefined, until);
          if (v) v.wander = Math.random() * U.TAU;
        }
      }
    },
    wind: {
      apply(w, e, fx) { fx.speed *= 1 + 0.35 * ramp(e); }
    },
    blackout: {
      apply(w, e, fx) { fx.vision = Math.min(fx.vision, 1 - 0.55 * ramp(e)); }
    },
    meteor: {
      start(w, e) { e.data = { timer: 0.5 }; },
      update(w, e, dt) {
        e.data.timer -= dt;
        if (e.data.timer > 0 || e.remaining < 2) return;
        e.data.timer = U.rand(0.35, 0.7);
        const alive = w.alivePlayers();
        let x, y;
        if (alive.length && Math.random() < 0.75) {
          // büyük oyunculara biraz daha fazla hedef
          const sorted = alive.slice().sort((a, b) => b.totalMass - a.totalMass);
          const p = Math.random() < 0.5 ? sorted[Math.min(sorted.length - 1, (Math.random() * 5) | 0)] : U.pick(alive);
          const a = Math.random() * U.TAU, d = U.rand(0, 700);
          x = p.cx + Math.cos(a) * d; y = p.cy + Math.sin(a) * d;
        } else {
          const p = w.randomPoint(300); x = p.x; y = p.y;
        }
        w.hazards.push({
          type: 'meteor', x: U.clamp(x, 100, w.size - 100), y: U.clamp(y, 100, w.size - 100),
          r: U.rand(200, 280), born: w.time, impactAt: w.time + 1.9, done: false
        });
      }
    },
    blackhole: {
      start(w, e) {
        const def = MG.BIOMES.gravity;
        let pos = w.randomPoint(1500);
        const h = w.human && w.human.alive ? w.human : null;
        for (let i = 0; i < 10 && h; i++) {
          if (U.dist(pos.x, pos.y, h.cx, h.cy) > 1600) break;
          pos = w.randomPoint(1500);
        }
        const b = { type: 'gravity', def, x: pos.x, y: pos.y, r: 1150, vx: 0, vy: 0, angle: 0, turn: 0, strength: def.strength, core: def.core, timer: 0, spin: 0, temp: true };
        w.addBiome(b);
        e.data = { biome: b };
      },
      end(w, e) { w.removeBiome(e.data.biome); }
    },
    frenzy: {
      apply(w, e, fx) { fx.decay = 0; fx.pelletValue *= 2; fx.merge = Math.min(fx.merge, 0.4); }
    },
    titan: {
      start(w, e) {
        e.data = { boss: w.director.spawnBoss() };
      },
      update(w, e) {
        const b = e.data.boss;
        if (!b || !b.alive) e.ended = true;
      },
      end(w, e) {
        const b = e.data.boss;
        if (b && b.alive) {
          w.chat(null, MG.t('system.titanLeft'));
          w.removePlayer(b);
        }
      }
    },
    power_storm: {
      start(w, e) {
        e.data = { list: [] };
        for (let i = 0; i < 12; i++) {
          const pu = w.spawnPowerUp();
          pu.temp = true;
          e.data.list.push(pu);
        }
      },
      end(w, e) {
        for (const pu of e.data.list) pu.dead = true;
      }
    }
  };

  // olaylar yumuşak başlayıp yumuşak biter
  function ramp(e) {
    return Math.min(1, e.t / 1.5, Math.max(0, e.duration - e.t) / 1.5);
  }

  class EventManager {
    constructor(w) {
      this.w = w;
      this.active = [];
      this.enabled = !!w.mode.events;
      this.nextAt = U.rand(30, 50) * w.mods.events;
      this.history = [];
      this.count = 0;
    }

    update(dt) {
      const w = this.w;
      const fx = w.fx;
      fx.speed = 1; fx.decay = 1; fx.merge = 1; fx.pelletValue = 1; fx.vision = 1; fx.goldChance = 0;
      for (let i = this.active.length - 1; i >= 0; i--) {
        const e = this.active[i];
        e.t += dt;
        e.remaining = e.duration - e.t;
        const h = H[e.id];
        if (h.update) h.update(w, e, dt);
        if (h.apply) h.apply(w, e, fx);
        if (e.t >= e.duration || e.ended) {
          if (h.end) h.end(w, e);
          this.active.splice(i, 1);
          w.emit('eventEnd', e);
        }
      }
      if (!this.enabled || w.over) return;
      if (w.time >= this.nextAt) {
        this.trigger();
        this.nextAt = w.time + U.rand(50, 80) * w.mods.events;
      }
    }

    isActive(id) { return this.active.some(e => e.id === id); }

    trigger(id) {
      const w = this.w;
      if (!id) {
        const recent = this.history.slice(-2);
        const pairs = [];
        for (const k in MG.EVENTS) {
          if (this.isActive(k) || recent.indexOf(k) >= 0) continue;
          if (k === 'titan' && (w.players.some(p => p.isBoss) || w.time < 90)) continue;
          if (k === 'power_storm' && w.mods.powerups === 0) continue;
          pairs.push([k, MG.EVENTS[k].weight]);
        }
        if (!pairs.length) return null;
        id = U.weighted(pairs);
      }
      const def = MG.EVENTS[id];
      const e = { id, def, t: 0, duration: def.duration, remaining: def.duration, data: {}, ended: false };
      H[id].start && H[id].start(w, e);
      this.active.push(e);
      this.history.push(id);
      this.count++;
      for (const p of w.players) if (p.alive) p.stats.events++;
      w.emit('eventStart', e);
      return e;
    }
  }

  MG.EventManager = EventManager;
})(window.MG = window.MG || {});
