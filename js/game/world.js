/* MAGGAR.io — dünya simülasyonu (fizik, yeme, bölünme, virüsler, biyomlar) */
(function (MG) {
  'use strict';
  const U = MG.U, CFG = MG.CFG, K = MG.KIND;
  const TAU = U.TAU;

  /* ---------- Yiyecek deposu: sabit ızgara + yoğunluk haritası ---------- */
  class PelletStore {
    constructor(size) {
      this.size = size;
      this.cs = CFG.PELLET_BUCKET;
      this.cols = Math.ceil(size / this.cs);
      this.buckets = new Array(this.cols * this.cols);
      for (let i = 0; i < this.buckets.length; i++) this.buckets[i] = [];
      this.dcs = CFG.DENSITY_BUCKET;
      this.dcols = Math.ceil(size / this.dcs);
      this.density = new Float32Array(this.dcols * this.dcols);
      this.count = 0;
    }
    key(x, y) {
      let bx = (x / this.cs) | 0, by = (y / this.cs) | 0;
      if (bx < 0) bx = 0; else if (bx >= this.cols) bx = this.cols - 1;
      if (by < 0) by = 0; else if (by >= this.cols) by = this.cols - 1;
      return by * this.cols + bx;
    }
    dkey(x, y) {
      let bx = (x / this.dcs) | 0, by = (y / this.dcs) | 0;
      if (bx < 0) bx = 0; else if (bx >= this.dcols) bx = this.dcols - 1;
      if (by < 0) by = 0; else if (by >= this.dcols) by = this.dcols - 1;
      return by * this.dcols + bx;
    }
    add(p) {
      const k = this.key(p.x, p.y);
      const b = this.buckets[k];
      p.bk = k; p.bi = b.length; p.dead = false;
      b.push(p);
      this.density[this.dkey(p.x, p.y)] += p.mass;
      this.count++;
    }
    _unlink(p) {
      const b = this.buckets[p.bk];
      const last = b.pop();
      if (last !== p) { b[p.bi] = last; last.bi = p.bi; }
    }
    remove(p) {
      if (p.dead) return;
      this._unlink(p);
      this.density[this.dkey(p.x, p.y)] -= p.mass;
      this.count--;
      p.dead = true;
    }
    move(p, x, y) {
      const dk0 = this.dkey(p.x, p.y);
      p.x = x; p.y = y;
      const dk1 = this.dkey(x, y);
      if (dk0 !== dk1) { this.density[dk0] -= p.mass; this.density[dk1] += p.mass; }
      const k = this.key(x, y);
      if (k !== p.bk) {
        this._unlink(p);
        const b = this.buckets[k];
        p.bk = k; p.bi = b.length; b.push(p);
      }
    }
    // Geriye doğru gezinir; geri çağrı o anki yiyeceği güvenle silebilir
    query(x0, y0, x1, y1, fn) {
      const cs = this.cs, cols = this.cols;
      let bx0 = (x0 / cs) | 0, by0 = (y0 / cs) | 0, bx1 = (x1 / cs) | 0, by1 = (y1 / cs) | 0;
      if (bx0 < 0) bx0 = 0; if (by0 < 0) by0 = 0;
      if (bx1 >= cols) bx1 = cols - 1; if (by1 >= cols) by1 = cols - 1;
      for (let by = by0; by <= by1; by++) {
        for (let bx = bx0; bx <= bx1; bx++) {
          const b = this.buckets[by * cols + bx];
          for (let i = b.length - 1; i >= 0; i--) {
            const p = b[i];
            if (p) fn(p);
          }
        }
      }
    }
    densityAt(x, y) {
      if (x < 0 || y < 0 || x >= this.size || y >= this.size) return -1;
      return this.density[this.dkey(x, y)];
    }
  }

  /* ---------- Hareketli hücreler için ızgara (her adımda yeniden kurulur) ---------- */
  class CellGrid {
    constructor(size, cs) {
      this.cs = cs;
      this.cols = Math.ceil(size / cs);
      this.buckets = new Array(this.cols * this.cols);
      for (let i = 0; i < this.buckets.length; i++) this.buckets[i] = [];
      this.used = [];
      this.maxR = 0;
    }
    clear() {
      for (const k of this.used) this.buckets[k].length = 0;
      this.used.length = 0;
      this.maxR = 0;
    }
    insert(c) {
      let bx = (c.x / this.cs) | 0, by = (c.y / this.cs) | 0;
      if (bx < 0) bx = 0; else if (bx >= this.cols) bx = this.cols - 1;
      if (by < 0) by = 0; else if (by >= this.cols) by = this.cols - 1;
      const k = by * this.cols + bx;
      const b = this.buckets[k];
      if (b.length === 0) this.used.push(k);
      b.push(c);
      if (c.r > this.maxR) this.maxR = c.r;
    }
    query(x0, y0, x1, y1, out) {
      const m = this.maxR;
      const cs = this.cs, cols = this.cols;
      let bx0 = ((x0 - m) / cs) | 0, by0 = ((y0 - m) / cs) | 0, bx1 = ((x1 + m) / cs) | 0, by1 = ((y1 + m) / cs) | 0;
      if (bx0 < 0) bx0 = 0; if (by0 < 0) by0 = 0;
      if (bx1 >= cols) bx1 = cols - 1; if (by1 >= cols) by1 = cols - 1;
      out.length = 0;
      for (let by = by0; by <= by1; by++) {
        for (let bx = bx0; bx <= bx1; bx++) {
          const b = this.buckets[by * cols + bx];
          for (let i = 0; i < b.length; i++) {
            const c = b[i];
            if (c.x + c.r < x0 || c.x - c.r > x1 || c.y + c.r < y0 || c.y - c.r > y1) continue;
            out.push(c);
          }
        }
      }
      return out;
    }
  }

  function byMinX(a, b) { return a._x0 - b._x0; }

  /* ---------- Dünya ---------- */
  class World {
    constructor(opts) {
      opts = opts || {};
      this.opts = opts;
      this.modeId = opts.mode || 'classic';
      this.mode = Object.assign({}, MG.MODES[this.modeId]);
      if (opts.events === false) this.mode.events = false;

      let arenaId = this.mode.arena;
      if (arenaId === 'random') {
        arenaId = opts.arena && opts.arena !== 'random' && MG.ARENAS[opts.arena] ? opts.arena : U.pick(MG.RANDOM_ARENAS);
      }
      if (arenaId === 'classic' && opts.darkClassic) arenaId = 'classicDark';
      this.arena = MG.ARENAS[arenaId];

      this.mutators = opts.mutators || [];
      this.mods = { pellets: 1, merge: 1, speed: 1, split: 1, viruses: 1, powerups: 1, events: 1, decay: 1, startMass: this.mode.startMass, botMass: 1 };
      for (const m of this.mutators) {
        for (const k in m.mod) {
          if (k === 'startMass') this.mods.startMass = Math.max(this.mods.startMass, m.mod[k]);
          else this.mods[k] *= m.mod[k];
        }
      }
      if (opts.powerups === false) this.mods.powerups = 0;

      this.size = this.mode.worldSize;
      this.time = 0;
      this.players = [];
      this.cells = [];
      this.ejects = [];
      this.viruses = [];
      this.powerups = [];
      this.mothers = [];
      this.hazards = [];
      this.biomes = [];
      this.pellets = new PelletStore(this.size);
      this.cellGrid = new CellGrid(this.size, CFG.CELL_BUCKET);
      this.bodies = [];
      this.listeners = {};
      this.fx = { speed: 1, decay: 1, merge: 1, pelletValue: 1, vision: 1, goldChance: 0 };
      this.leaderboard = [];
      this.lbTimer = 0;
      this.teamMass = [0, 0, 0, 0];
      this.targets = {
        pellets: Math.round(this.mode.pellets * this.mods.pellets),
        viruses: Math.round(this.mode.viruses * this.mods.viruses),
        powerups: Math.round((this.mode.powerups || 0) * this.mods.powerups),
        mothers: this.mode.mothers || 0
      };
      this.pelletAcc = 0;
      this.avgDensity = Math.max(1, (this.targets.pellets * 1.15) / (this.pellets.dcols * this.pellets.dcols));
      this.virusTimer = 0;
      this.powerTimer = 3;
      this.motherTimer = 0;
      this.gravTimer = 0;
      this.over = false;
      this.result = null;
      this.human = null;
      this.chatLog = [];
      this.humanFood = 0;

      if (this.mode.biomes && this.arena.biomes.length) this.generateBiomes();

      this.events = new MG.EventManager(this);
      this.modeCtl = MG.createModeController(this);
      this.director = new MG.AIDirector(this, opts);
      this.populate();
    }

    /* ---- olay yayını ---- */
    on(type, fn) { (this.listeners[type] || (this.listeners[type] = [])).push(fn); }
    emit(type, data) {
      const l = this.listeners[type];
      if (l) for (let i = 0; i < l.length; i++) l[i](data);
    }

    /* ---- kurulum ---- */
    generateBiomes() {
      const types = this.arena.biomes;
      const S = this.size;
      const placed = [];
      const place = (r, minSep) => {
        for (let t = 0; t < 40; t++) {
          const x = U.rand(r * 0.7, S - r * 0.7), y = U.rand(r * 0.7, S - r * 0.7);
          let ok = true;
          for (const b of placed) if (U.dist(x, y, b.x, b.y) < (r + b.r) * minSep) { ok = false; break; }
          if (ok) return { x, y };
        }
        return { x: U.rand(r, S - r), y: U.rand(r, S - r) };
      };
      for (const type of types) {
        const def = MG.BIOMES[type];
        if (type === 'wormhole') {
          const a = place(def.radius[0], 1.2);
          let b = null;
          for (let t = 0; t < 30; t++) {
            const c = place(def.radius[0], 1.2);
            if (U.dist(a.x, a.y, c.x, c.y) > S * 0.45) { b = c; break; }
          }
          if (!b) b = { x: S - a.x, y: S - a.y };
          const pa = { type, def, x: a.x, y: a.y, r: def.radius[0], vx: 0, vy: 0, pair: null, spin: 0 };
          const pb = { type, def, x: b.x, y: b.y, r: def.radius[0], vx: 0, vy: 0, pair: pa, spin: 0 };
          pa.pair = pb;
          placed.push(pa, pb);
          continue;
        }
        const r = U.rand(def.radius[0], def.radius[1]) * (this.size < 8000 ? 0.8 : 1);
        const pos = place(r, 0.85);
        const drift = type === 'gravity' || type === 'vent' ? 0 : 14;
        placed.push({
          type, def, x: pos.x, y: pos.y, r,
          vx: U.rand(-drift, drift), vy: U.rand(-drift, drift),
          angle: Math.random() * TAU, turn: U.rand(-0.06, 0.06),
          strength: def.strength || 0, core: def.core || 0,
          timer: U.rand(2, 6), spin: 0
        });
      }
      placed.sort((a, b) => a.r - b.r);
      this.biomes = placed;
    }

    addBiome(b) {
      this.biomes.push(b);
      this.biomes.sort((a, c) => a.r - c.r);
    }

    removeBiome(b) {
      const i = this.biomes.indexOf(b);
      if (i >= 0) this.biomes.splice(i, 1);
    }

    biomeAt(x, y) {
      const bs = this.biomes;
      for (let i = 0; i < bs.length; i++) {
        const b = bs[i];
        const dx = x - b.x, dy = y - b.y;
        if (dx * dx + dy * dy < b.r * b.r) return b;
      }
      return null;
    }

    populate() {
      for (let i = 0; i < this.targets.pellets; i++) this.spawnPellet();
      for (let i = 0; i < this.targets.viruses; i++) this.spawnVirus();
      for (let i = 0; i < this.targets.mothers; i++) this.spawnMother();
      for (let i = 0; i < this.targets.powerups; i++) this.spawnPowerUp();
      this.rebuildCellGrid();
      this.director.init();
      this.modeCtl.init();
      this.rebuildCellGrid();
      this.updateLeaderboard();
    }

    randomPoint(margin) {
      margin = margin || 50;
      return { x: U.rand(margin, this.size - margin), y: U.rand(margin, this.size - margin) };
    }

    spawnPellet(x, y, mass, gold) {
      if (x === undefined) {
        let placed = false;
        if (this.biomes.length && Math.random() < 0.3) {
          const rich = this.biomes.filter(b => b.type === 'nebula');
          if (rich.length) {
            const b = U.pick(rich);
            const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * b.r;
            x = U.clamp(b.x + Math.cos(a) * d, 10, this.size - 10);
            y = U.clamp(b.y + Math.sin(a) * d, 10, this.size - 10);
            placed = true;
          }
        }
        if (!placed) { x = U.rand(10, this.size - 10); y = U.rand(10, this.size - 10); }
      }
      if (mass === undefined) mass = Math.random() < 0.1 ? 2 : 1;
      if (gold === undefined) gold = this.fx.goldChance > 0 && Math.random() < this.fx.goldChance;
      let c = (Math.random() * MG.PELLET_COLORS.length) | 0;
      if (gold) { mass = 5; c = -1; }
      else if (this.biomes.length) {
        const b = this.biomeAt(x, y);
        if (b && b.type === 'lava') { mass *= 2; c = -2; }
      }
      const p = { x, y, mass, r: Math.min(10 + (mass - 1) * 2.4, 22), c, gold, bk: 0, bi: 0, dead: false };
      this.pellets.add(p);
      return p;
    }

    spawnVirus(x, y, temp) {
      if (x === undefined) {
        let pos = null;
        for (let t = 0; t < 15; t++) {
          const c = this.randomPoint(200);
          if (!this.overlapsCell(c.x, c.y, 160)) { pos = c; break; }
        }
        if (!pos) return null;
        x = pos.x; y = pos.y;
      }
      const v = new MG.Virus(x, y, CFG.VIRUS_MASS);
      if (temp) { v.temp = true; v.expireAt = temp; }
      this.viruses.push(v);
      return v;
    }

    spawnMother() {
      let pos = null;
      for (let t = 0; t < 15; t++) {
        const c = this.randomPoint(400);
        if (!this.overlapsCell(c.x, c.y, 300)) { pos = c; break; }
      }
      if (!pos) return null;
      const m = new MG.MotherCell(pos.x, pos.y, 220);
      this.mothers.push(m);
      return m;
    }

    spawnPowerUp(type, x, y) {
      if (!type) type = U.weighted(MG.POWERUP_WEIGHTS);
      if (x === undefined) {
        const p = this.randomPoint(300);
        x = p.x; y = p.y;
      }
      const pu = new MG.PowerUp(x, y, type, this.time);
      this.powerups.push(pu);
      return pu;
    }

    overlapsCell(x, y, pad) {
      const out = this._tmpQ || (this._tmpQ = []);
      this.cellGrid.query(x - pad, y - pad, x + pad, y + pad, out);
      for (const c of out) if (U.dist(x, y, c.x, c.y) < c.r + pad) return true;
      return false;
    }

    findSpawn(mass) {
      const r = U.massToRadius(mass);
      const out = [];
      let best = null, bestScore = -Infinity;
      const zone = this.modeCtl.zone;
      for (let i = 0; i < 14; i++) {
        let x, y;
        if (zone) {
          const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * zone.r * 0.85;
          x = U.clamp(zone.x + Math.cos(a) * d, r + 50, this.size - r - 50);
          y = U.clamp(zone.y + Math.sin(a) * d, r + 50, this.size - r - 50);
        } else {
          x = U.rand(r + 150, this.size - r - 150);
          y = U.rand(r + 150, this.size - r - 150);
        }
        let minD = 1600;
        this.cellGrid.query(x - 1600, y - 1600, x + 1600, y + 1600, out);
        for (const c of out) {
          if (c.mass > mass * 1.1) {
            const d = U.dist(x, y, c.x, c.y) - c.r;
            if (d < minD) minD = d;
          }
        }
        for (const v of this.viruses) {
          if (U.dist(x, y, v.x, v.y) < v.r + r + 20) minD -= 800;
        }
        if (minD > bestScore) { bestScore = minD; best = { x, y }; }
        if (minD >= 1600) break;
      }
      return best;
    }

    addCell(c) {
      this.cells.push(c);
      c.owner.cells.push(c);
    }

    addPlayer(p) {
      if (this.players.indexOf(p) < 0) this.players.push(p);
    }

    removePlayer(p) {
      for (const c of p.cells) c.dead = true;
      p.cells.length = 0;
      p.alive = false;
      const i = this.players.indexOf(p);
      if (i >= 0) this.players.splice(i, 1);
      this.cells = this.cells.filter(c => c.owner !== p);
    }

    spawnPlayer(p, mass, x, y) {
      const m = mass || this.mods.startMass;
      const pos = x !== undefined ? { x, y } : this.findSpawn(m);
      this.addPlayer(p);
      for (const c of p.cells) c.dead = true;
      p.cells = [];
      p.stats = MG.Player.newStats();
      p.stats.spawnTime = this.time;
      p.power = null;
      p.effects = {};
      p.lastEatenBy = null;
      p.killedBy = null;
      p.deathCause = null;
      p.wantSplit = 0; p.wantEject = 0; p.ejecting = false; p.wantPower = false;
      p.comboTimes = [];
      const c = new MG.Cell(p, pos.x, pos.y, m, this.time);
      this.addCell(c);
      p.alive = true;
      p.targetX = pos.x; p.targetY = pos.y;
      p.updateCenter();
      this.emit('spawn', { player: p });
      return c;
    }

    /* ---- sorgular (yapay zekâ ve çizim için) ---- */
    queryCells(x0, y0, x1, y1, out) { return this.cellGrid.query(x0, y0, x1, y1, out || []); }

    cellSpeed(r, p) {
      let s = CFG.SPEED_BASE * Math.pow(r, CFG.SPEED_EXP) * this.mods.speed * this.fx.speed;
      if (p) {
        if (p.effects.speed > 0) s *= 1.45;
        if (p.effects.frozen > 0) s *= 0.5;
        if (p.isBoss) s *= 1.2;
        if (this.modeCtl.speedMul) s *= this.modeCtl.speedMul(p);
      }
      return s;
    }

    splitDistance(r) { return CFG.SPLIT_DIST + r * 1.1; }

    mergeDelay(mass) {
      const t = (this.mode.mergeBase + Math.min(mass * CFG.MERGE_MASS_FACTOR, 60)) * this.mods.merge * this.fx.merge;
      return Math.max(4, t);
    }

    // Referans 1920x1080 ekrana göre görüş yarıçapı (insan ve bot için aynı)
    viewZoom(p) {
      const sr = Math.max(p.sumR, 1);
      return Math.pow(Math.min(64 / sr, 1), 0.4);
    }

    isHiddenFrom(c, viewer) {
      const o = c.owner;
      const inFog = c.biome === 'fog';
      const ghost = o.effects.ghost > 0;
      if (!inFog && !ghost) return false;
      if (!viewer || !viewer.alive) return false;
      if (o === viewer || (viewer.team && viewer.team === o.team)) return false;
      const range = ghost ? 240 : 380;
      for (const m of viewer.cells) {
        const d = U.dist(m.x, m.y, c.x, c.y) - m.r - c.r;
        if (d < range) return false;
      }
      return true;
    }

    chat(player, text, extra) {
      const msg = {
        id: player ? player.id : 0,
        name: player ? player.name : MG.t('system.name'),
        color: player ? player.color.hex : '#ffd23f',
        team: player ? player.team : 0,
        text, time: this.time, system: !player, human: player ? player.isHuman : false
      };
      if (extra) Object.assign(msg, extra);
      this.chatLog.push(msg);
      if (this.chatLog.length > 60) this.chatLog.shift();
      this.emit('chat', msg);
      return msg;
    }

    /* ---- ana adım ---- */
    step(dt) {
      if (dt <= 0) return;
      if (dt > 0.1) dt = 0.1;
      const n = Math.ceil(dt / (1 / 60) - 1e-6);
      const h = dt / n;
      for (let i = 0; i < n; i++) this.tick(h);
    }

    tick(dt) {
      this.time += dt;
      this.events.update(dt);
      this.modeCtl.update(dt);
      if (this.biomes.length) this.updateBiomes(dt);
      this.director.update(dt);

      const players = this.players;
      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        if (!p.alive) continue;
        const ef = p.effects;
        for (const k in ef) {
          ef[k] -= dt;
          if (ef[k] <= 0) { delete ef[k]; this.emit('effectEnd', { player: p, type: k }); }
        }
        if (p.brain) p.brain.update(dt);
        this.processActions(p, dt);
      }

      this.moveCells(dt);
      this.moveEjects(dt);
      this.moveViruses(dt);
      if (this.mothers.length) this.updateMothers(dt);
      if (this.hazards.length) this.updateHazards(dt);
      this.resolveCollisions();
      this.eatPellets(dt);
      this.applyDecay(dt);
      this.cleanup();
      this.replenish(dt);
      this.updatePlayers(dt);
      this.rebuildCellGrid();
    }

    rebuildCellGrid() {
      const g = this.cellGrid;
      g.clear();
      const cs = this.cells;
      for (let i = 0; i < cs.length; i++) g.insert(cs[i]);
    }

    processActions(p, dt) {
      if (p.wantSplit > 0) {
        p.wantSplit--;
        this.splitPlayer(p);
      }
      p.ejectTimer -= dt;
      if ((p.ejecting || p.wantEject > 0) && p.ejectTimer <= 0) {
        this.ejectPlayer(p);
        p.ejectTimer = CFG.EJECT_COOLDOWN;
        if (p.wantEject > 0) p.wantEject--;
      }
      if (p.wantPower) {
        p.wantPower = false;
        this.usePower(p);
      }
    }

    moveCells(dt) {
      const bd = Math.exp(-CFG.BOOST_DECAY * dt);
      const S = this.size;
      const cells = this.cells;
      const hasBiomes = this.biomes.length > 0;
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        const p = c.owner;
        const dx = p.targetX - c.x, dy = p.targetY - c.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        let spd = this.cellSpeed(c.r, p);
        let k = 14, ex = 0, ey = 0;
        c.biome = null;
        if (hasBiomes) {
          const b = this.biomeAt(c.x, c.y);
          if (b) {
            c.biome = b.type;
            switch (b.type) {
              case 'ice': k = 1.25; spd *= 1.15; break;
              case 'speed': spd *= MG.BIOMES.speed.speedMul; break;
              case 'current': {
                const f = U.clamp(350 / c.r, 0.35, 1.2);
                ex = Math.cos(b.angle) * b.strength * f;
                ey = Math.sin(b.angle) * b.strength * f;
                break;
              }
              case 'gravity': {
                const gx = b.x - c.x, gy = b.y - c.y;
                const gd = Math.sqrt(gx * gx + gy * gy) + 1;
                const pull = b.strength * (1 - gd / b.r) * U.clamp(320 / c.r, 0.35, 1.3);
                ex = (gx / gd) * pull;
                ey = (gy / gd) * pull;
                break;
              }
              case 'wormhole':
                if (this.time >= c.tpAt && U.dist(c.x, c.y, b.x, b.y) < b.r * 0.7 && b.pair) this.teleport(c, b);
                break;
            }
          }
        }
        const f = d > 0.01 ? Math.min(1, d / (c.r * 0.6 + 40)) : 0;
        const vx = d > 0.01 ? (dx / d) * spd * f : 0;
        const vy = d > 0.01 ? (dy / d) * spd * f : 0;
        const a = 1 - Math.exp(-k * dt);
        c.mvx += (vx - c.mvx) * a;
        c.mvy += (vy - c.mvy) * a;
        c.x += (c.mvx + c.bvx + ex) * dt;
        c.y += (c.mvy + c.bvy + ey) * dt;
        c.bvx *= bd; c.bvy *= bd;
        const m = c.r * 0.5;
        if (c.x < m) { c.x = m; if (c.bvx < 0) c.bvx = -c.bvx; if (c.mvx < 0) c.mvx *= 0.5; }
        else if (c.x > S - m) { c.x = S - m; if (c.bvx > 0) c.bvx = -c.bvx; if (c.mvx > 0) c.mvx *= 0.5; }
        if (c.y < m) { c.y = m; if (c.bvy < 0) c.bvy = -c.bvy; if (c.mvy < 0) c.mvy *= 0.5; }
        else if (c.y > S - m) { c.y = S - m; if (c.bvy > 0) c.bvy = -c.bvy; if (c.mvy > 0) c.mvy *= 0.5; }
      }
    }

    teleport(c, b) {
      const out = b.pair;
      let sp = Math.sqrt(c.mvx * c.mvx + c.mvy * c.mvy);
      let ang = sp > 1 ? Math.atan2(c.mvy, c.mvx) : Math.random() * TAU;
      const off = out.r + c.r * 0.6 + 30;
      c.x = U.clamp(out.x + Math.cos(ang) * off, c.r * 0.5, this.size - c.r * 0.5);
      c.y = U.clamp(out.y + Math.sin(ang) * off, c.r * 0.5, this.size - c.r * 0.5);
      c.tpAt = this.time + 2.5;
      this.emit('teleport', { cell: c, from: b, to: out });
    }

    moveEjects(dt) {
      const bd = Math.exp(-CFG.BOOST_DECAY * dt);
      const S = this.size;
      for (const e of this.ejects) {
        if (e.bvx === 0 && e.bvy === 0) continue;
        e.x += e.bvx * dt; e.y += e.bvy * dt;
        e.bvx *= bd; e.bvy *= bd;
        if (Math.abs(e.bvx) < 2 && Math.abs(e.bvy) < 2) { e.bvx = 0; e.bvy = 0; }
        if (e.x < e.r) { e.x = e.r; e.bvx = Math.abs(e.bvx); }
        else if (e.x > S - e.r) { e.x = S - e.r; e.bvx = -Math.abs(e.bvx); }
        if (e.y < e.r) { e.y = e.r; e.bvy = Math.abs(e.bvy); }
        else if (e.y > S - e.r) { e.y = S - e.r; e.bvy = -Math.abs(e.bvy); }
      }
    }

    moveViruses(dt) {
      const bd = Math.exp(-CFG.BOOST_DECAY * dt);
      const S = this.size;
      const moving = this.mode.movingViruses;
      for (const v of this.viruses) {
        if (v.temp && this.time > v.expireAt) { v.dead = true; continue; }
        let mx = 0, my = 0;
        if (moving || v.temp) {
          v.wander += U.rand(-0.6, 0.6) * dt;
          mx = Math.cos(v.wander) * 45; my = Math.sin(v.wander) * 45;
        }
        v.x += (v.bvx + mx) * dt; v.y += (v.bvy + my) * dt;
        v.bvx *= bd; v.bvy *= bd;
        if (v.x < v.r) { v.x = v.r; v.bvx = Math.abs(v.bvx); v.wander = Math.PI - v.wander; }
        else if (v.x > S - v.r) { v.x = S - v.r; v.bvx = -Math.abs(v.bvx); v.wander = Math.PI - v.wander; }
        if (v.y < v.r) { v.y = v.r; v.bvy = Math.abs(v.bvy); v.wander = -v.wander; }
        else if (v.y > S - v.r) { v.y = S - v.r; v.bvy = -Math.abs(v.bvy); v.wander = -v.wander; }
      }
    }

    updateMothers(dt) {
      const cap = this.targets.pellets + this.mothers.length * 70;
      for (const m of this.mothers) {
        m.timer -= dt;
        if (m.timer <= 0) {
          m.timer = 0.22;
          if (this.pellets.count < cap) {
            const a = Math.random() * TAU, d = m.r + U.rand(20, 260);
            const x = U.clamp(m.x + Math.cos(a) * d, 10, this.size - 10);
            const y = U.clamp(m.y + Math.sin(a) * d, 10, this.size - 10);
            this.spawnPellet(x, y, U.chance(0.25) ? 2 : 1);
          }
        }
      }
    }

    updateBiomes(dt) {
      const S = this.size;
      this.gravTimer -= dt;
      const doGrav = this.gravTimer <= 0;
      if (doGrav) this.gravTimer = 0.1;
      for (const b of this.biomes) {
        b.spin += dt;
        if (b.vx || b.vy) {
          b.x += b.vx * dt; b.y += b.vy * dt;
          if (b.x < b.r * 0.5 || b.x > S - b.r * 0.5) { b.vx = -b.vx; b.x = U.clamp(b.x, b.r * 0.5, S - b.r * 0.5); }
          if (b.y < b.r * 0.5 || b.y > S - b.r * 0.5) { b.vy = -b.vy; b.y = U.clamp(b.y, b.r * 0.5, S - b.r * 0.5); }
        }
        if (b.type === 'current') b.angle += b.turn * dt;
        else if (b.type === 'vent') {
          b.timer -= dt;
          if (b.timer <= 0) {
            b.timer = U.rand(4, 7);
            const n = U.randInt(12, 18);
            for (let i = 0; i < n; i++) {
              const a = Math.random() * TAU, d = U.rand(b.r * 0.3, b.r * 1.6);
              this.spawnPellet(U.clamp(b.x + Math.cos(a) * d, 10, S - 10), U.clamp(b.y + Math.sin(a) * d, 10, S - 10), 2);
            }
            this.emit('vent', { biome: b });
          }
        } else if (b.type === 'gravity' && doGrav) {
          const R = b.r * 0.75, core = b.core;
          const store = this.pellets;
          store.query(b.x - R, b.y - R, b.x + R, b.y + R, p => {
            const dx = b.x - p.x, dy = b.y - p.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > R) return;
            if (d < core * 0.5) { store.remove(p); return; }
            const s = 26 * (1 - d / R) + 4;
            // sarmal hareket
            const nx = p.x + (dx / d) * s - (dy / d) * s * 0.6;
            const ny = p.y + (dy / d) * s + (dx / d) * s * 0.6;
            store.move(p, nx, ny);
          });
        }
      }
    }

    updateHazards(dt) {
      for (const h of this.hazards) {
        if (h.done) continue;
        if (this.time >= h.impactAt) {
          h.done = true;
          this.meteorImpact(h);
        }
      }
      this.hazards = this.hazards.filter(h => !h.done || this.time - h.impactAt < 0.8);
    }

    meteorImpact(h) {
      const out = [];
      this.cellGrid.query(h.x - h.r, h.y - h.r, h.x + h.r, h.y + h.r, out);
      for (const c of out) {
        if (c.dead) continue;
        const d = U.dist(h.x, h.y, c.x, c.y);
        if (d > h.r + c.r * 0.5) continue;
        if (c.owner.effects.shield > 0) continue;
        const lost = c.mass * 0.14;
        if (c.mass - lost < 10) continue;
        c.setMass(c.mass - lost);
        const n = Math.min(40, Math.max(3, Math.round(lost / 3)));
        const pm = lost / n;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * TAU, dd = c.r + U.rand(30, 260);
          this.spawnPellet(U.clamp(c.x + Math.cos(a) * dd, 10, this.size - 10), U.clamp(c.y + Math.sin(a) * dd, 10, this.size - 10), Math.max(1, Math.round(pm)));
        }
        const a = Math.atan2(c.y - h.y, c.x - h.x);
        const v = 500 * CFG.BOOST_DECAY * 0.3;
        c.bvx += Math.cos(a) * v; c.bvy += Math.sin(a) * v;
        this.emit('meteorHit', { cell: c, player: c.owner });
      }
      this.emit('meteorImpact', { hazard: h });
    }

    /* ---- eylemler ---- */
    splitPlayer(p, dirX, dirY) {
      const list = p.cells.slice().sort((a, b) => b.mass - a.mass);
      const mul = this.mods.split * (p.effects.rocket > 0 ? 1.7 : 1);
      let any = false;
      for (const c of list) {
        if (p.cells.length >= CFG.MAX_CELLS) break;
        if (c.dead || c.mass < CFG.MIN_SPLIT_MASS) continue;
        let dx, dy;
        if (dirX !== undefined) { dx = dirX; dy = dirY; }
        else { dx = p.targetX - c.x; dy = p.targetY - c.y; }
        let d = Math.sqrt(dx * dx + dy * dy);
        if (d < 1) {
          dx = c.mvx; dy = c.mvy; d = Math.sqrt(dx * dx + dy * dy);
          if (d < 1) { dx = 1; dy = 0; d = 1; }
        }
        const nx = dx / d, ny = dy / d;
        const half = c.mass / 2;
        c.setMass(half);
        const nc = new MG.Cell(p, c.x + nx * 2, c.y + ny * 2, half, this.time);
        const v0 = this.splitDistance(nc.r) * mul * CFG.BOOST_DECAY;
        nc.bvx = nx * v0; nc.bvy = ny * v0;
        nc.mvx = c.mvx; nc.mvy = c.mvy;
        const mt = this.time + this.mergeDelay(half);
        c.mergeAt = mt; nc.mergeAt = mt;
        this.addCell(nc);
        any = true;
      }
      if (any) this.emit('split', { player: p });
      return any;
    }

    ejectPlayer(p) {
      if (this.ejects.length > 1600) return false;
      let any = false;
      for (const c of p.cells) {
        if (c.mass < CFG.MIN_EJECT_MASS) continue;
        let dx = p.targetX - c.x, dy = p.targetY - c.y;
        let d = Math.sqrt(dx * dx + dy * dy);
        if (d < 1) { dx = c.mvx || 1; dy = c.mvy; d = Math.sqrt(dx * dx + dy * dy) || 1; }
        const ang = Math.atan2(dy, dx) + U.rand(-0.15, 0.15);
        c.setMass(c.mass - CFG.EJECT_LOSS);
        const cos = Math.cos(ang), sin = Math.sin(ang);
        const e = new MG.Eject(c.x + cos * c.r, c.y + sin * c.r, CFG.EJECT_MASS, p, this.time, ang);
        const v0 = CFG.EJECT_DIST * CFG.BOOST_DECAY;
        e.bvx = cos * v0; e.bvy = sin * v0;
        this.ejects.push(e);
        any = true;
      }
      if (any) this.emit('eject', { player: p });
      return any;
    }

    usePower(p) {
      const t = p.power;
      if (!t || !p.alive) return false;
      p.power = null;
      const def = MG.POWERUPS[t];
      if (t === 'freeze') {
        const out = [];
        const R = 850;
        this.cellGrid.query(p.cx - R, p.cy - R, p.cx + R, p.cy + R, out);
        const hit = new Set();
        for (const c of out) {
          const o = c.owner;
          if (o === p || (p.team && o.team === p.team)) continue;
          if (U.dist(p.cx, p.cy, c.x, c.y) > R + c.r) continue;
          if (o.effects.shield > 0) continue;
          o.effects.frozen = 3.5;
          hit.add(o);
        }
        this.emit('freeze', { player: p, x: p.cx, y: p.cy, r: R, count: hit.size });
      } else {
        p.effects[t] = def.duration;
      }
      this.emit('power', { player: p, type: t });
      return true;
    }

    /* ---- çarpışmalar: süpür ve buda ---- */
    resolveCollisions() {
      const B = this.bodies;
      B.length = 0;
      const add = arr => {
        for (let i = 0; i < arr.length; i++) {
          const b = arr[i];
          if (b.dead) continue;
          b._x0 = b.x - b.r; b._x1 = b.x + b.r; b._y0 = b.y - b.r; b._y1 = b.y + b.r;
          B.push(b);
        }
      };
      add(this.cells); add(this.viruses); add(this.ejects); add(this.powerups); add(this.mothers);
      B.sort(byMinX);
      const n = B.length;
      for (let i = 0; i < n; i++) {
        const a = B[i];
        if (a.dead) continue;
        const ax1 = a._x1;
        const ka = a.kind;
        for (let j = i + 1; j < n; j++) {
          const b = B[j];
          if (b._x0 > ax1) break;
          if (b.dead) continue;
          if (a._y1 < b._y0 || b._y1 < a._y0) continue;
          const kb = b.kind;
          if (ka === K.CELL) {
            if (kb === K.CELL) this.cellCell(a, b);
            else this.cellOther(a, b);
          } else if (kb === K.CELL) {
            this.cellOther(b, a);
          } else if (ka === K.VIRUS && kb === K.EJECT) {
            this.virusFeed(a, b);
          } else if (kb === K.VIRUS && ka === K.EJECT) {
            this.virusFeed(b, a);
          }
          if (a.dead) break;
        }
      }
    }

    cellCell(a, b) {
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      const rs = a.r + b.r;
      if (d2 >= rs * rs) return;
      const d = Math.sqrt(d2);
      const pa = a.owner, pb = b.owner;
      if (pa === pb) { this.ownPair(a, b, dx, dy, d); return; }
      if (pa.team && pa.team === pb.team) return;
      let big = a, small = b;
      if (b.mass > a.mass) { big = b; small = a; }
      if (big.mass < small.mass * CFG.EAT_RATIO) return;
      if (d > big.r - small.r * CFG.EAT_OVERLAP) return;
      if (small.owner.effects.shield > 0) return;
      this.eatCell(big, small);
    }

    ownPair(a, b, dx, dy, d) {
      const now = this.time;
      if (now >= a.mergeAt && now >= b.mergeAt) {
        let big = a, small = b;
        if (b.mass > a.mass) { big = b; small = a; }
        if (d < big.r - small.r * 0.25) {
          big.setMass(big.mass + small.mass);
          small.dead = true;
          this.emit('merge', { player: a.owner, cell: big });
        }
        return;
      }
      if (now - a.born < CFG.NO_COLLIDE_TIME || now - b.born < CFG.NO_COLLIDE_TIME) return;
      const overlap = a.r + b.r - d;
      if (overlap <= 0) return;
      let nx = 1, ny = 0;
      if (d > 0.01) { nx = dx / d; ny = dy / d; }
      const tot = a.mass + b.mass;
      const fa = (b.mass / tot) * overlap * 0.6, fb = (a.mass / tot) * overlap * 0.6;
      a.x -= nx * fa; a.y -= ny * fa;
      b.x += nx * fb; b.y += ny * fb;
    }

    eatCell(big, small) {
      small.dead = true;
      big.setMass(big.mass + small.mass);
      const bp = big.owner, sp = small.owner;
      bp.stats.cellsEaten++;
      bp.stats.massEaten += small.mass;
      sp.lastEatenBy = bp;
      sp.lastEatenAt = this.time;
      let alive = 0;
      for (const c of sp.cells) if (!c.dead) alive++;
      if (alive === 0) sp.killedBy = bp;
      this.emit('eat', { eater: big, victim: small, ep: bp, vp: sp, last: alive === 0 });
    }

    cellOther(c, o) {
      const dx = o.x - c.x, dy = o.y - c.y;
      const d2 = dx * dx + dy * dy;
      switch (o.kind) {
        case K.EJECT: {
          if (d2 > c.r * c.r) return;
          if (o.owner === c.owner && this.time - o.born < 0.3) return;
          o.dead = true;
          c.setMass(c.mass + o.mass);
          if (o.owner && o.owner !== c.owner) {
            if (c.owner.team && o.owner.team === c.owner.team) o.owner.stats.feedGiven += o.mass;
            this.emit('fed', { from: o.owner, to: c.owner, mass: o.mass });
          }
          return;
        }
        case K.VIRUS: {
          if (c.mass < o.mass * CFG.VIRUS_POP_RATIO) return;
          if (c.owner.effects.ghost > 0) return;
          const d = Math.sqrt(d2);
          if (d > c.r - o.r * CFG.EAT_OVERLAP) return;
          o.dead = true;
          c.setMass(c.mass + o.mass);
          this.popCell(c, o);
          return;
        }
        case K.POWER: {
          const d = Math.sqrt(d2);
          if (d > c.r + o.r * 0.3) return;
          o.dead = true;
          this.collectPower(c.owner, o, c);
          return;
        }
        case K.MOTHER: {
          if (c.mass < o.mass * CFG.EAT_RATIO) return;
          const d = Math.sqrt(d2);
          if (d > c.r - o.r * CFG.EAT_OVERLAP) return;
          o.dead = true;
          c.setMass(c.mass + o.mass);
          this.motherTimer = Math.max(this.motherTimer, 8);
          this.emit('motherEaten', { cell: c, mother: o });
          return;
        }
      }
    }

    popCell(c, virus) {
      const p = c.owner;
      const shooter = virus.shooter && this.time - virus.shotAt < 8 ? virus.shooter : null;
      if (shooter && shooter !== p) shooter.stats.virusShots++;
      this.emit('virusPop', { cell: c, player: p, x: virus.x, y: virus.y, shooter });
      const slots = CFG.MAX_CELLS - p.cells.length;
      if (slots <= 0) return;
      let n = Math.min(slots, 15);
      const total = c.mass;
      let piece = Math.min(total / (n + 1), Math.max(total * 0.05, 36));
      if (piece < 10) { piece = 10; n = Math.max(0, Math.floor(total / 10) - 1); }
      if (n <= 0) return;
      c.setMass(total - piece * n);
      const base = Math.random() * TAU;
      for (let i = 0; i < n; i++) {
        const ang = base + (i / n) * TAU + U.rand(-0.25, 0.25);
        const nc = new MG.Cell(p, c.x, c.y, piece, this.time);
        const v0 = this.splitDistance(nc.r) * U.rand(0.5, 0.85) * CFG.BOOST_DECAY;
        nc.bvx = Math.cos(ang) * v0; nc.bvy = Math.sin(ang) * v0;
        nc.mergeAt = this.time + this.mergeDelay(piece);
        this.addCell(nc);
      }
      c.mergeAt = this.time + this.mergeDelay(c.mass);
    }

    virusFeed(v, e) {
      const dx = e.x - v.x, dy = e.y - v.y;
      if (dx * dx + dy * dy > v.r * v.r) return;
      e.dead = true;
      v.feeds++;
      v.setMass(Math.min(v.mass + e.mass, CFG.VIRUS_MAX_MASS));
      v.feedAngle = e.angle;
      if (e.owner) e.owner.stats.virusFeeds++;
      this.emit('virusFed', { virus: v, by: e.owner });
      if (v.feeds >= CFG.VIRUS_FEEDS) {
        v.feeds = 0;
        v.setMass(CFG.VIRUS_MASS);
        if (this.viruses.length < this.targets.viruses * 1.6 + 12) {
          const nv = new MG.Virus(v.x, v.y, CFG.VIRUS_MASS);
          const v0 = CFG.VIRUS_SHOT_DIST * CFG.BOOST_DECAY;
          nv.bvx = Math.cos(v.feedAngle) * v0;
          nv.bvy = Math.sin(v.feedAngle) * v0;
          nv.shooter = e.owner;
          nv.shotAt = this.time;
          this.viruses.push(nv);
          this.emit('virusShot', { virus: nv, shooter: e.owner });
        }
      }
    }

    collectPower(p, pu, cell) {
      p.stats.powerups++;
      if (pu.type === 'crown') { this.modeCtl.onCrownPickup && this.modeCtl.onCrownPickup(p, pu); return; }
      const def = MG.POWERUPS[pu.type];
      if (def.instant) {
        const add = Math.max(25, p.totalMass * 0.08);
        cell.setMass(cell.mass + add);
      } else {
        p.power = pu.type;
      }
      if (!pu.temp) this.powerTimer = Math.min(this.powerTimer, U.rand(6, 14));
      this.emit('powerup', { player: p, type: pu.type, instant: !!def.instant });
    }

    /* ---- yiyecekler ---- */
    eatPellets(dt) {
      const store = this.pellets;
      const cs = store.cs, cols = store.cols;
      const val = this.fx.pelletValue;
      const cells = this.cells;
      for (let ci = 0; ci < cells.length; ci++) {
        const c = cells[ci];
        if (c.dead) continue;
        const r = c.r, r2 = r * r;
        const mag = c.owner.effects.magnet > 0;
        const qr = mag ? r + 380 : r;
        const qr2 = qr * qr;
        let bx0 = ((c.x - qr) / cs) | 0, by0 = ((c.y - qr) / cs) | 0, bx1 = ((c.x + qr) / cs) | 0, by1 = ((c.y + qr) / cs) | 0;
        if (bx0 < 0) bx0 = 0; if (by0 < 0) by0 = 0;
        if (bx1 >= cols) bx1 = cols - 1; if (by1 >= cols) by1 = cols - 1;
        let gained = 0, count = 0;
        for (let by = by0; by <= by1; by++) {
          for (let bx = bx0; bx <= bx1; bx++) {
            const b = store.buckets[by * cols + bx];
            for (let i = b.length - 1; i >= 0; i--) {
              const p = b[i];
              if (!p) continue;
              const dx = p.x - c.x, dy = p.y - c.y;
              const d2 = dx * dx + dy * dy;
              if (d2 < r2) {
                gained += p.mass;
                count++;
                store.remove(p);
              } else if (mag && d2 < qr2) {
                const d = Math.sqrt(d2);
                const s = Math.min(d - r * 0.5, 700 * dt);
                store.move(p, p.x - (dx / d) * s, p.y - (dy / d) * s);
              }
            }
          }
        }
        if (count) {
          c.setMass(c.mass + gained * val);
          c.owner.stats.food += count;
          if (c.owner.isHuman) this.humanFood += count;
        }
      }
    }

    applyDecay(dt) {
      const base = CFG.DECAY_RATE * this.mods.decay * this.fx.decay;
      const now = this.time;
      for (const c of this.cells) {
        if (c.dead) continue;
        let rate = base, min = CFG.DECAY_MIN_MASS;
        if (c.biome === 'lava') { rate = CFG.DECAY_RATE * MG.BIOMES.lava.decayMul; min = 15; }
        else if (c.biome === 'gravity') {
          const b = this.biomeAt(c.x, c.y);
          if (b && b.type === 'gravity' && U.dist(c.x, c.y, b.x, b.y) < b.core + c.r * 0.3) {
            rate = Math.max(rate, MG.BIOMES.gravity.drain); min = 10;
          }
        }
        // büyük hücreler orantısal olarak daha hızlı erir (kaçak liderleri dengeler)
        if (rate > 0 && c.mass > min) c.setMass(Math.max(min, c.mass - c.mass * rate * U.clamp(0.5 + c.mass / 4000, 0.6, 4) * dt));
        if (c.mass > CFG.MAX_CELL_MASS) {
          const p = c.owner;
          if (p.cells.length < CFG.MAX_CELLS) {
            const half = c.mass / 2;
            c.setMass(half);
            const a = Math.random() * TAU;
            const nc = new MG.Cell(p, c.x, c.y, half, now);
            const v0 = this.splitDistance(nc.r) * 0.6 * CFG.BOOST_DECAY;
            nc.bvx = Math.cos(a) * v0; nc.bvy = Math.sin(a) * v0;
            nc.mergeAt = c.mergeAt = now + this.mergeDelay(half);
            this.addCell(nc);
          } else {
            c.setMass(CFG.MAX_CELL_MASS);
          }
        }
      }
    }

    cleanup() {
      let w = 0;
      const cells = this.cells;
      let anyDead = false;
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        if (c.dead) { anyDead = true; continue; }
        cells[w++] = c;
      }
      cells.length = w;
      if (anyDead) {
        for (const p of this.players) {
          if (!p.alive) continue;
          let dirty = false;
          for (const c of p.cells) if (c.dead) { dirty = true; break; }
          if (dirty) p.cells = p.cells.filter(c => !c.dead);
          if (p.cells.length === 0) this.killPlayer(p);
        }
      }
      if (this.ejects.some(e => e.dead)) this.ejects = this.ejects.filter(e => !e.dead);
      if (this.viruses.some(v => v.dead)) this.viruses = this.viruses.filter(v => !v.dead);
      if (this.powerups.some(v => v.dead)) this.powerups = this.powerups.filter(v => !v.dead);
      if (this.mothers.some(v => v.dead)) this.mothers = this.mothers.filter(v => !v.dead);
    }

    killPlayer(p, cause) {
      if (!p.alive) return;
      p.alive = false;
      p.stats.deathTime = this.time;
      let killer = p.killedBy || (this.time - p.lastEatenAt < 1.5 ? p.lastEatenBy : null);
      if (killer === p) killer = null;
      if (killer) {
        killer.stats.kills++;
        const ct = killer.comboTimes;
        ct.push(this.time);
        while (ct.length && this.time - ct[0] > 6) ct.shift();
        if (ct.length > killer.stats.comboBest) killer.stats.comboBest = ct.length;
      }
      p.power = null;
      p.effects = {};
      this.modeCtl.onDeath && this.modeCtl.onDeath(p, killer);
      this.emit('death', { player: p, killer, cause: cause || p.deathCause || (killer ? 'eaten' : 'other') });
      this.director.onDeath(p, killer);
    }

    replenish(dt) {
      const t = this.targets;
      if (this.pellets.count < t.pellets) {
        this.pelletAcc += t.pellets * 0.07 * dt;
        let n = Math.min(this.pelletAcc | 0, t.pellets - this.pellets.count);
        this.pelletAcc -= n;
        while (n-- > 0) this.spawnPellet();
      } else this.pelletAcc = 0;

      this.virusTimer -= dt;
      let permanent = 0;
      for (const v of this.viruses) if (!v.temp) permanent++;
      if (this.virusTimer <= 0 && permanent < t.viruses) {
        this.virusTimer = 1.2;
        this.spawnVirus();
      }
      if (t.powerups > 0) {
        this.powerTimer -= dt;
        let perm = 0;
        for (const p of this.powerups) if (!p.temp && p.type !== 'crown') perm++;
        if (this.powerTimer <= 0 && perm < t.powerups) {
          this.powerTimer = U.rand(4, 10);
          this.spawnPowerUp();
        }
      }
      if (t.mothers > 0) {
        this.motherTimer -= dt;
        if (this.motherTimer <= 0 && this.mothers.length < t.mothers) {
          this.motherTimer = 6;
          this.spawnMother();
        }
      }
    }

    updatePlayers(dt) {
      for (const p of this.players) {
        if (!p.alive) continue;
        p.updateCenter();
        if (p.totalMass > p.stats.highestMass) p.stats.highestMass = p.totalMass;
      }
      this.lbTimer -= dt;
      if (this.lbTimer <= 0) {
        this.lbTimer = 0.5;
        this.updateLeaderboard();
        const top = this.leaderboard[0];
        if (top && top.player.alive) top.player.stats.topTime += 0.5;
      }
    }

    updateLeaderboard() {
      const crown = this.mode.crown;
      const list = [];
      for (const p of this.players) if (p.alive) list.push(p);
      if (crown) list.sort((a, b) => b.crownPoints - a.crownPoints || b.totalMass - a.totalMass);
      else list.sort((a, b) => b.totalMass - a.totalMass);
      this.leaderboard = list.map((p, i) => ({ player: p, name: p.name, mass: p.totalMass, points: p.crownPoints, rank: i + 1 }));
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        p.rank = i + 1;
        if (p.rank < p.stats.bestRank) p.stats.bestRank = p.rank;
      }
      if (this.mode.teams) {
        const tm = [0, 0, 0, 0];
        for (const p of list) tm[p.team] += p.totalMass;
        this.teamMass = tm;
      }
    }

    alivePlayers() { return this.players.filter(p => p.alive); }
  }

  MG.World = World;
  MG.PelletStore = PelletStore;
})(window.MG = window.MG || {});
