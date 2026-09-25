/* MAGGAR.io — insansı yapay zekâ: kişilikli botlar + uyarlanabilir yönetmen */
(function (MG) {
  'use strict';
  const U = MG.U, CFG = MG.CFG;
  const TAU = U.TAU;

  // Kişilik arketipleri: her bot bu aralıklardan kendine özgü değerler çeker
  const ARCHETYPES = {
    newbie: { skill: [0.12, 0.32], aggression: [0.2, 0.55], caution: [0.15, 0.4], greed: [0.5, 0.8], virusUse: [0, 0.05], splitSkill: [0.05, 0.25], teamwork: [0.2, 0.5], chat: [0.4, 0.8], reaction: [380, 620], aimNoise: [0.25, 0.45], turn: [3, 5], samples: 10, splitAware: 0.2, patience: [2, 4] },
    casual: { skill: [0.32, 0.55], aggression: [0.35, 0.6], caution: [0.4, 0.6], greed: [0.5, 0.8], virusUse: [0.05, 0.2], splitSkill: [0.25, 0.5], teamwork: [0.3, 0.6], chat: [0.3, 0.6], reaction: [270, 420], aimNoise: [0.15, 0.28], turn: [4.5, 7], samples: 14, splitAware: 0.55, patience: [3, 6] },
    farmer: { skill: [0.4, 0.62], aggression: [0.1, 0.3], caution: [0.7, 0.92], greed: [0.85, 1], virusUse: [0.05, 0.2], splitSkill: [0.2, 0.45], teamwork: [0.4, 0.7], chat: [0.2, 0.5], reaction: [240, 380], aimNoise: [0.12, 0.22], turn: [5, 7], samples: 16, splitAware: 0.75, patience: [2, 4] },
    friendly: { skill: [0.38, 0.6], aggression: [0.15, 0.4], caution: [0.5, 0.7], greed: [0.6, 0.8], virusUse: [0.05, 0.2], splitSkill: [0.25, 0.5], teamwork: [0.85, 1], chat: [0.6, 0.95], reaction: [250, 400], aimNoise: [0.12, 0.25], turn: [4.5, 7], samples: 14, splitAware: 0.6, patience: [3, 5] },
    hunter: { skill: [0.58, 0.82], aggression: [0.75, 0.95], caution: [0.4, 0.62], greed: [0.4, 0.6], virusUse: [0.2, 0.45], splitSkill: [0.6, 0.85], teamwork: [0.2, 0.5], chat: [0.25, 0.55], reaction: [170, 280], aimNoise: [0.06, 0.14], turn: [7, 10], samples: 20, splitAware: 0.9, patience: [5, 9] },
    tactician: { skill: [0.7, 0.9], aggression: [0.5, 0.72], caution: [0.62, 0.85], greed: [0.5, 0.7], virusUse: [0.7, 0.95], splitSkill: [0.65, 0.9], teamwork: [0.5, 0.8], chat: [0.2, 0.45], reaction: [160, 250], aimNoise: [0.05, 0.1], turn: [8, 11], samples: 22, splitAware: 1, patience: [4, 8] },
    pro: { skill: [0.88, 1], aggression: [0.7, 0.9], caution: [0.72, 0.9], greed: [0.5, 0.7], virusUse: [0.6, 0.9], splitSkill: [0.9, 1], teamwork: [0.4, 0.7], chat: [0.15, 0.4], reaction: [120, 200], aimNoise: [0.02, 0.06], turn: [10, 14], samples: 24, splitAware: 1, patience: [6, 10], tricksplit: true },
    boss: { skill: [0.85, 0.95], aggression: [0.95, 1], caution: [0.3, 0.5], greed: [0.3, 0.5], virusUse: [0, 0], splitSkill: [0.7, 0.9], teamwork: [0, 0], chat: [0, 0], reaction: [180, 240], aimNoise: [0.04, 0.08], turn: [6, 8], samples: 20, splitAware: 1, patience: [8, 12] }
  };
  MG.ARCHETYPES = ARCHETYPES;

  class Brain {
    constructor(player, world, arche, dm) {
      this.p = player;
      this.w = world;
      this.arche = arche;
      this.rollTraits(dm || 1);
      this.heading = Math.random() * TAU;
      this.desired = this.heading;
      this.cursorDist = 400;
      this.aimPoint = null;
      this.aimUntil = 0;
      this.nextThink = 0;
      this.goal = 'farm';
      this.target = null;
      this.targetSince = 0;
      this.targetBestD = Infinity;
      this.ignore = new Map();
      this.pending = [];
      this.plan = null;
      this.nextPlanAt = 0;
      this.grudges = new Map();
      this.fear = 0;
      this.tilt = 0;
      this.confidence = 0.5;
      this.seed = Math.random() * 1000;
      this.lastChat = -99;
      this.lastMass = 0;
      this.massCheckAt = 0;
      this.ejectUntil = 0;
      this.lastSplitAt = -99;
      this.focusPlayer = null;
      this.focusUntil = 0;
      this.helpTarget = null;
      this.helpUntil = 0;
      this.nextFeedAt = 0;
      this.idleUntil = 0;
      this.others = [];
      this.threats = [];
      this.preys = [];
      this.friends = [];
      this.nearViruses = [];
    }

    get label() { return MG.t('arche.' + this.arche); }

    rollTraits(dm) {
      const A = ARCHETYPES[this.arche];
      const r = rr => U.rand(rr[0], rr[1]);
      this.t = {
        skill: U.clamp(r(A.skill) * dm, 0.05, 1),
        aggression: U.clamp(r(A.aggression) * (0.85 + dm * 0.15), 0, 1),
        caution: r(A.caution),
        greed: r(A.greed),
        virusUse: r(A.virusUse),
        splitSkill: U.clamp(r(A.splitSkill) * dm, 0, 1),
        teamwork: r(A.teamwork),
        chat: r(A.chat),
        reaction: r(A.reaction) / dm,
        aimNoise: r(A.aimNoise) / dm,
        turn: r(A.turn) * Math.min(1.3, dm),
        samples: A.samples,
        splitAware: Math.min(1, A.splitAware * dm),
        patience: r(A.patience),
        tricksplit: !!A.tricksplit
      };
    }

    onRespawn() {
      this.pending.length = 0;
      this.plan = null;
      this.goal = 'farm';
      this.target = null;
      this.aimPoint = null;
      this.ejectUntil = 0;
      this.tilt = Math.min(1, this.tilt + 0.25);
      this.lastMass = 0;
    }

    addGrudge(player, level) {
      if (!player || player === this.p) return;
      const g = this.grudges.get(player.id) || { level: 0, until: 0 };
      g.level = Math.min(3, g.level + level);
      g.until = this.w.time + 60 + level * 40;
      this.grudges.set(player.id, g);
    }

    grudge(player) {
      const g = this.grudges.get(player.id);
      return g && g.until > this.w.time ? g.level : 0;
    }

    friendly(op) {
      return this.p.isAlly(op, this.w.time);
    }

    get effAggr() { return U.clamp(this.t.aggression + this.tilt * 0.25 + (this.confidence - 0.5) * 0.2, 0, 1); }
    get effCaution() { return U.clamp(this.t.caution - this.tilt * 0.25, 0.05, 1); }

    say(kind, delay, force) {
      const w = this.w;
      if (!force && w.time - this.lastChat < 9) return;
      const lines = typeof kind === 'string' ? MG.Chat[kind] : kind;
      if (!lines || !lines.length) return;
      this.lastChat = w.time;
      const text = U.pick(lines);
      // yazma süresi: insan gibi
      this.pending.push({ at: w.time + (delay !== undefined ? delay : U.rand(0.6, 1.4)) + text.length * 0.04, type: 'chat', text });
    }

    setAim(x, y, dur) {
      this.aimPoint = { x, y };
      this.aimUntil = this.w.time + dur;
    }

    update(dt) {
      const p = this.p, w = this.w, now = w.time;
      if (!p.alive) return;
      for (let i = this.pending.length - 1; i >= 0; i--) {
        const a = this.pending[i];
        if (now >= a.at) { this.pending.splice(i, 1); this.execute(a); }
      }
      if (now >= this.nextThink) this.think(now);
      p.ejecting = now < this.ejectUntil;
      this.moveCursor(dt, now);
    }

    moveCursor(dt, now) {
      const p = this.p;
      if (this.aimPoint && now < this.aimUntil) {
        const ap = this.aimPoint;
        const err = this.t.aimNoise * 60;
        p.targetX = ap.x + Math.sin(now * 7 + this.seed) * err;
        p.targetY = ap.y + Math.cos(now * 6.3 + this.seed) * err;
        this.heading = Math.atan2(p.targetY - p.cy, p.targetX - p.cx);
        this.desired = this.heading;
        return;
      }
      this.aimPoint = null;
      if (now < this.idleUntil) {
        // kısa duraksama: fareyi hücrenin üstünde bırakan oyuncu gibi
        p.targetX = p.cx + Math.cos(this.heading) * 20;
        p.targetY = p.cy + Math.sin(this.heading) * 20;
        return;
      }
      const diff = U.angleDiff(this.heading, this.desired);
      const maxTurn = this.t.turn * dt;
      this.heading += U.clamp(diff, -maxTurn, maxTurn);
      const wobble = U.smoothNoise(now * 1.7, this.seed) * this.t.aimNoise * 0.5;
      const a = this.heading + wobble;
      p.targetX = p.cx + Math.cos(a) * this.cursorDist;
      p.targetY = p.cy + Math.sin(a) * this.cursorDist;
    }

    execute(a) {
      const p = this.p, w = this.w;
      if (a.type === 'chat') { w.chat(p, a.text); return; }
      if (!p.alive) return;
      switch (a.type) {
        case 'split': {
          let tx = a.tx, ty = a.ty;
          if (a.target) {
            const o = a.target;
            if (o.dead) { if (a.recheck) return; }
            else {
              const lead = 0.18 * this.t.skill;
              tx = o.x + (o.mvx + o.bvx) * lead;
              ty = o.y + (o.mvy + o.bvy) * lead;
              if (a.recheck) {
                const big = p.biggest();
                const reach = w.splitDistance(U.massToRadius(big.mass / 2)) * w.mods.split * (p.effects.rocket > 0 ? 1.7 : 1) + big.r;
                if (!big || big.mass / 2 < o.mass * CFG.EAT_RATIO || U.dist(big.x, big.y, tx, ty) > reach * 1.1) return;
              }
            }
          }
          const err = this.t.aimNoise * 40;
          p.targetX = tx + U.rand(-err, err);
          p.targetY = ty + U.rand(-err, err);
          this.setAim(p.targetX, p.targetY, 0.3);
          p.wantSplit++;
          this.lastSplitAt = w.time;
          break;
        }
        case 'split2':
          if (p.cells.length < CFG.MAX_CELLS) p.wantSplit++;
          break;
        case 'eject':
          p.wantEject += a.n || 1;
          break;
        case 'power':
          if (p.power) p.wantPower = true;
          break;
      }
    }

    viewRange() {
      const w = this.w;
      return (1150 / w.viewZoom(this.p)) * w.fx.vision;
    }

    think(now) {
      const p = this.p, w = this.w, t = this.t;
      this.nextThink = now + (t.reaction * U.rand(0.75, 1.3)) / 1000;
      const cells = p.cells;
      if (!cells.length) return;
      const big = p.biggest();
      const cx = p.cx, cy = p.cy;
      const view = this.viewRange();

      // ---- ruh hali ----
      if (now >= this.massCheckAt) {
        if (this.lastMass > 0 && p.totalMass < this.lastMass * 0.7) this.tilt = Math.min(1, this.tilt + 0.3);
        this.lastMass = p.totalMass;
        this.massCheckAt = now + 3;
      }
      this.tilt *= 0.985;
      this.confidence = U.lerp(this.confidence, p.rank > 0 && p.rank <= 3 ? 0.85 : p.rank <= 10 ? 0.6 : 0.4, 0.05);

      // ---- algı ----
      const others = w.queryCells(cx - view, cy - view, cx + view, cy + view, this.others);
      const threats = this.threats, preys = this.preys, friends = this.friends;
      threats.length = 0; preys.length = 0; friends.length = 0;
      let maxDanger = 0, worst = null;
      const caution = this.effCaution;
      const shielded = p.effects.shield > 0;
      for (let i = 0; i < others.length; i++) {
        const o = others[i];
        const op = o.owner;
        if (op === p) continue;
        if (p.team && op.team === p.team) { friends.push(o); continue; }
        if (w.isHiddenFrom(o, p)) continue;
        const dC = U.dist(cx, cy, o.x, o.y);
        // dikkat: tecrübesiz oyuncular uzaktakileri kaçırabilir
        if (dC > view * (0.45 + 0.55 * t.skill) && Math.random() > t.skill) continue;
        let near = cells[0], nd = Infinity;
        for (let j = 0; j < cells.length; j++) {
          const m = cells[j];
          const d = U.dist(m.x, m.y, o.x, o.y) - m.r;
          if (d < nd) { nd = d; near = m; }
        }
        if (o.mass > near.mass * 1.2) {
          const canSplit = o.mass >= CFG.MIN_SPLIT_MASS && o.mass * 0.5 > near.mass * CFG.EAT_RATIO && op.cells.length < CFG.MAX_CELLS;
          const splitReach = canSplit ? (w.splitDistance(U.massToRadius(o.mass / 2)) * w.mods.split + o.r * 0.3) * t.splitAware : 0;
          const cd = U.dist(near.x, near.y, o.x, o.y);
          const gap = cd - o.r - splitReach;
          const range = 350 + 550 * caution;
          let danger = U.clamp(1 - gap / range, 0, 2);
          if (this.friendly(op)) danger *= 0.35;
          if (shielded) danger *= 0.1;
          if (danger > 0.02) {
            const th = { o, near, gap, danger, splitReach, cd };
            threats.push(th);
            if (danger > maxDanger) { maxDanger = danger; worst = th; }
          }
        } else if (big.mass > o.mass * CFG.EAT_RATIO) {
          preys.push({ o, d: U.dist(big.x, big.y, o.x, o.y) });
        }
      }
      if (threats.length > 8) { threats.sort((a, b) => b.danger - a.danger); threats.length = 8; }
      this.fear = U.lerp(this.fear, Math.min(1, maxDanger), 0.35);

      const viruses = this.nearViruses;
      viruses.length = 0;
      for (const v of w.viruses) if (Math.abs(v.x - cx) < view && Math.abs(v.y - cy) < view) viruses.push(v);

      // ---- plan sürüyorsa (virüs atışı) ----
      if (this.plan && maxDanger < 0.8) {
        if (this.runPlan(now)) return;
      } else if (this.plan) {
        this.plan = null; this.ejectUntil = 0;
      }

      // ---- hedef seçimi (fayda tabanlı) ----
      const aggr = this.effAggr;
      let best = 'farm', bestU = 0.3 * (0.5 + t.greed * 0.5) * (1 - Math.min(maxDanger, 1) * 0.6), bestData = null;
      const consider = (g, u, data) => {
        if (g === this.goal) u += 0.12;
        if (u > bestU) { bestU = u; best = g; bestData = data; }
      };

      consider('flee', maxDanger * (0.55 + caution * 0.9));

      // virüs altına saklan
      if (worst && maxDanger > 0.35 && big.mass < CFG.VIRUS_MASS * CFG.VIRUS_POP_RATIO * 0.95 && worst.o.mass > CFG.VIRUS_MASS * CFG.VIRUS_POP_RATIO && cells.length <= 2) {
        let hv = null, hd = 480 + t.skill * 200;
        for (const v of viruses) {
          const d = U.dist(big.x, big.y, v.x, v.y);
          const dt = U.dist(worst.o.x, worst.o.y, v.x, v.y);
          if (d < hd && dt > d * 0.6) { hd = d; hv = v; }
        }
        if (hv) consider('hide', maxDanger * (0.7 + caution * 0.6) + 0.15 * t.skill, hv);
      }

      // av
      let bestPrey = null, bestPU = 0;
      const mySpd = w.cellSpeed(big.r, p);
      const skRange = w.splitDistance(U.massToRadius(big.mass / 2)) * w.mods.split + big.r * 0.2;
      const crownHolder = w.modeCtl.holder || null;
      for (const pr of preys) {
        const o = pr.o, op = o.owner;
        if (this.friendly(op)) continue;
        const ig = this.ignore.get(op.id);
        if (ig && ig > now) continue;
        const itsSpd = w.cellSpeed(o.r, op);
        let u = (o.mass / (pr.d + 250)) * 6;
        const canSK = big.mass / 2 > o.mass * 1.3 && cells.length < CFG.MAX_CELLS && big.mass >= 36;
        if (canSK && pr.d < skRange * 1.2) u *= 2.2;
        else if (itsSpd > mySpd * 1.05) u *= 0.35;
        const m = 300;
        if (o.x < m || o.y < m || o.x > w.size - m || o.y > w.size - m) u *= 1.4;
        if (big.mass > 133) {
          for (const v of viruses) if (U.dist(v.x, v.y, o.x, o.y) < v.r + o.r) { u *= 0.25; break; }
        }
        const g = this.grudge(op);
        if (g) u *= 1 + g * 0.6;
        if (op === this.focusPlayer && now < this.focusUntil) u *= 2;
        if (op === crownHolder) u *= 3;
        if (this.target && this.target.owner === op) u *= 1.35;
        if (o.mass < big.mass * 0.02) u *= 0.4;
        if (op.isBoss) u *= 1.5;
        if (u > bestPU) { bestPU = u; bestPrey = pr; }
      }
      if (bestPrey) consider('hunt', bestPU * (0.4 + aggr) * (1 - Math.min(maxDanger, 1) * 0.8), bestPrey);

      // güç küresi / taç
      let bestOrb = null, orbU = 0;
      for (const pu of w.powerups) {
        if (pu.dead) continue;
        const d = U.dist(cx, cy, pu.x, pu.y);
        if (d > view) continue;
        if (pu.type !== 'crown' && p.power && pu.type !== 'mass') continue;
        let u = (pu.type === 'crown' ? 1.6 : 0.6) * (1 - d / (view * 1.2)) + 0.1;
        if (u > orbU) { orbU = u; bestOrb = pu; }
      }
      if (bestOrb) consider('power', orbU * (1 - Math.min(maxDanger, 1) * 0.7), bestOrb);

      // yardım çağrısına koş
      if (this.helpTarget && now < this.helpUntil && this.helpTarget.alive) {
        const h = this.helpTarget;
        const d = U.dist(cx, cy, h.cx, h.cy);
        if (d > 500) consider('escort', 0.65 * (1 - Math.min(maxDanger, 1) * 0.7), h);
      }

      // yeniden birleş
      if (cells.length > 1 && maxDanger < 0.25) {
        let ready = true;
        for (const c of cells) if (now < c.mergeAt - 1.5) { ready = false; break; }
        if (ready) consider('regroup', 0.45);
      }

      // Son Hücre: alan dışındaysan önce içeri gir
      const zone = w.modeCtl.zone;
      if (zone) {
        const zd = U.dist(cx, cy, zone.x, zone.y);
        const inner = zone.state === 'wait' ? Math.min(zone.r, zone.toR + (zone.r - zone.toR) * 0.35) : zone.r;
        if (zd > inner * 0.85) consider('zone', 0.5 + (zd - inner * 0.85) / 400, zone);
      }

      this.goal = best;
      this.cursorDist = 260 + big.r * 1.3;

      // ---- hareket ----
      let primary = null, pw = 0;
      switch (best) {
        case 'hunt': {
          const o = bestData.o;
          if (!this.target || this.target.owner !== o.owner) { this.targetSince = now; this.targetBestD = bestData.d; }
          this.target = o;
          if (bestData.d < this.targetBestD - 40) { this.targetBestD = bestData.d; this.targetSince = now; }
          else if (now - this.targetSince > t.patience) {
            // sabrı taşan insan gibi vazgeç
            this.ignore.set(o.owner.id, now + U.rand(4, 9));
            this.target = null;
          }
          const lead = 0.4 * t.skill;
          primary = { x: o.x + (o.mvx + o.bvx) * lead, y: o.y + (o.mvy + o.bvy) * lead };
          pw = 2.4;
          if (this.grudge(o.owner) > 1 && Math.random() < 0.08) this.say('revenge');
          break;
        }
        case 'hide':
          this.setAim(bestData.x, bestData.y, (t.reaction / 1000) * 1.4);
          this.considerPower(maxDanger, null, now);
          return;
        case 'power':
          primary = bestData; pw = 2;
          break;
        case 'escort':
          primary = { x: bestData.cx, y: bestData.cy }; pw = 2;
          break;
        case 'regroup':
          this.setAim(cx, cy, (t.reaction / 1000) * 1.3);
          this.cursorDist = 30;
          return;
        case 'zone':
          primary = { x: bestData.state === 'wait' ? bestData.toX : bestData.x, y: bestData.state === 'wait' ? bestData.toY : bestData.y };
          pw = 2.6;
          break;
        case 'farm': {
          this.target = null;
          if (big.mass < 500) {
            const pl = this.pickFood(big);
            if (pl) { primary = pl; pw = 1.3; }
          }
          if (t.skill < 0.45 && Math.random() < 0.015) this.idleUntil = now + U.rand(0.4, 1.2);
          break;
        }
      }

      this.desired = this.chooseDirection(primary, pw, threats, viruses, maxDanger, big, cx, cy);

      // ---- eylemler ----
      if (best === 'hunt' || (best === 'farm' && preys.length && aggr > 0.4)) this.considerSplitKill(preys, threats, now);
      if (best === 'flee') this.considerEscapeSplit(worst, now);
      this.considerPower(maxDanger, best === 'hunt' ? bestData : null, now);
      if (!this.plan && maxDanger < 0.4) this.considerVirusShot(threats, preys, viruses, now);
      if (maxDanger < 0.3) this.considerFeed(friends, now);
      this.quirks(now, maxDanger, big);
    }

    pickFood(big) {
      const w = this.w;
      const R = 260 + big.r * 1.2;
      let best = null, bestS = -Infinity;
      const hx = this.heading;
      w.pellets.query(big.x - R, big.y - R, big.x + R, big.y + R, pl => {
        const dx = pl.x - big.x, dy = pl.y - big.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > R) return;
        const turn = Math.abs(U.angleDiff(hx, Math.atan2(dy, dx)));
        const s = (pl.mass / (d + 60)) * (1 - (turn / Math.PI) * 0.6);
        if (s > bestS) { bestS = s; best = pl; }
      });
      const R2 = R * 1.6;
      for (const e of w.ejects) {
        if (Math.abs(e.x - big.x) > R2 || Math.abs(e.y - big.y) > R2) continue;
        if (e.owner === this.p && w.time - e.born < 1.5) continue;
        const d = U.dist(big.x, big.y, e.x, e.y);
        const s = e.mass / (d + 60);
        if (s > bestS) { bestS = s; best = e; }
      }
      return best;
    }

    chooseDirection(primary, pw, threats, viruses, maxDanger, big, cx, cy) {
      const t = this.t, w = this.w, p = this.p;
      const N = t.samples;
      const off = (Math.random() * TAU) / N;
      let px = 0, py = 0;
      if (primary) {
        const dx = primary.x - cx, dy = primary.y - cy;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        px = dx / d; py = dy / d;
      }
      const hx = Math.cos(this.heading), hy = Math.sin(this.heading);
      const step = 300 + big.r;
      const foodW = (this.goal === 'farm' ? (primary ? 0.5 : 1) : 0.35) * (0.6 + t.greed * 0.6);
      const avgD = w.avgDensity;
      const threatW = 1 + this.effCaution * 1.2;
      const mySpd = w.cellSpeed(big.r, p);
      const look = mySpd * 0.8 + big.r;
      const S = w.size, mg = big.r * 0.5 + 80;
      const canPop = big.mass > CFG.VIRUS_MASS * CFG.VIRUS_POP_RATIO && p.cells.length < CFG.MAX_CELLS && !(p.effects.ghost > 0);
      const zone = w.modeCtl.zone;
      const hasBiomes = w.biomes.length > 0;
      let bestA = this.heading, bestS = -Infinity;
      for (let k = 0; k < N; k++) {
        const a = off + (k / N) * TAU;
        const c = Math.cos(a), s = Math.sin(a);
        let sc = 0;
        if (primary) sc += pw * (c * px + s * py);
        let food = 0;
        for (let j = 1; j <= 3; j++) {
          const dd = w.pellets.densityAt(cx + c * step * j, cy + s * step * j);
          if (dd < 0) { food -= 0.6; break; }
          food += dd / avgD / j;
        }
        sc += foodW * food * 0.35;
        for (let i = 0; i < threats.length; i++) sc -= threatW * this.threatPenalty(threats[i], c, s);
        const fx = cx + c * look, fy = cy + s * look;
        const bw = 0.6 + maxDanger;
        if (fx < mg) sc -= ((mg - fx) / 300) * bw;
        else if (fx > S - mg) sc -= ((fx - S + mg) / 300) * bw;
        if (fy < mg) sc -= ((mg - fy) / 300) * bw;
        else if (fy > S - mg) sc -= ((fy - S + mg) / 300) * bw;
        if (canPop) {
          for (const v of viruses) {
            const vx = v.x - big.x, vy = v.y - big.y;
            const vd = Math.sqrt(vx * vx + vy * vy) || 1;
            if (vd > big.r + v.r + 400) continue;
            const dot = (c * vx + s * vy) / vd;
            if (dot > 0.3) sc -= dot * U.clamp(1 - (vd - big.r - v.r) / 400, 0, 1) * 1.6 * (0.4 + t.skill);
          }
        } else if (maxDanger > 0.3 && big.mass < 120) {
          for (const v of viruses) {
            const vx = v.x - big.x, vy = v.y - big.y;
            const vd = Math.sqrt(vx * vx + vy * vy) || 1;
            if (vd > 650) continue;
            sc += ((c * vx + s * vy) / vd) * 0.45 * maxDanger * t.skill;
          }
        }
        if (zone) {
          const zd = U.dist(fx, fy, zone.x, zone.y);
          if (zd > zone.r * 0.9) sc -= ((zd - zone.r * 0.9) / 300) * 2;
        }
        if (hasBiomes) {
          const b = w.biomeAt(fx, fy);
          if (b) {
            switch (b.type) {
              case 'lava': sc -= 0.5 * (1 - t.greed * 0.6); break;
              case 'speed': sc += 0.15; break;
              case 'nebula': sc += 0.2 * t.greed; break;
              case 'gravity': if (U.dist(fx, fy, b.x, b.y) < b.r * 0.55) sc -= 1.2; break;
              case 'fog': sc += (this.effAggr - 0.5) * 0.3; break;
            }
          }
        }
        sc += (c * hx + s * hy) * (0.25 + (1 - t.skill) * 0.2);
        sc += (Math.random() - 0.5) * (1 - t.skill) * 0.5;
        if (sc > bestS) { bestS = sc; bestA = a; }
      }
      return bestA;
    }

    threatPenalty(th, c, s) {
      const w = this.w, m = th.near, o = th.o;
      const tau = 0.45 + this.t.caution * 0.35;
      const mySpd = w.cellSpeed(m.r, this.p);
      const oSpd = w.cellSpeed(o.r, o.owner);
      const fx = m.x + c * mySpd * tau, fy = m.y + s * mySpd * tau;
      const d = U.dist(fx, fy, o.x, o.y) - oSpd * tau;
      const gap = d - (o.r + th.splitReach + 40);
      const imp = 0.5 + 0.5 * Math.min(1, (m.mass / Math.max(1, this.p.totalMass)) * 2);
      if (gap < 0) return (3 + -gap / 200) * imp;
      return Math.exp(-gap / (200 + 250 * this.t.caution)) * 2.2 * imp;
    }

    considerSplitKill(preys, threats, now) {
      const p = this.p, w = this.w, t = this.t;
      if (now - this.lastSplitAt < 0.9 || p.cells.length >= CFG.MAX_CELLS) return false;
      if (this.pending.some(a => a.type === 'split')) return false;
      const big = p.biggest();
      if (!big || big.mass < 36) return false;
      const half = big.mass / 2;
      const need = CFG.EAT_RATIO * (0.92 + t.skill * 0.2);
      const reach = w.splitDistance(U.massToRadius(half)) * w.mods.split * (p.effects.rocket > 0 ? 1.7 : 1) + U.massToRadius(half) * 0.6;
      let best = null, bestV = 0;
      for (const pr of preys) {
        const o = pr.o;
        if (half < o.mass * need) continue;
        if (o.owner.effects.shield > 0 || this.friendly(o.owner)) continue;
        const lead = 0.22 * t.skill;
        const tx = o.x + (o.mvx + o.bvx) * lead, ty = o.y + (o.mvy + o.bvy) * lead;
        const d = U.dist(big.x, big.y, tx, ty);
        if (d > reach * (0.75 + t.skill * 0.25)) continue;
        if (t.skill > 0.4 && o.mass < Math.max(8, big.mass * 0.04)) continue;
        if (half > 133 && t.skill > 0.3 && this.virusInPath(big.x, big.y, tx, ty)) continue;
        let risk = 0;
        for (const th of threats) {
          if (th.o.mass > half * CFG.EAT_RATIO) {
            const dd = U.dist(th.o.x, th.o.y, tx, ty) - th.o.r - th.splitReach;
            if (dd < 350) risk++;
          }
        }
        if (risk > 0 && Math.random() > (this.tilt + (1 - this.effCaution)) * 0.3) continue;
        const v = o.mass / (d + 100);
        if (v > bestV) { bestV = v; best = { o, tx, ty, d }; }
      }
      if (!best) return false;
      if (Math.random() > t.splitSkill * (0.55 + this.effAggr * 0.5)) return false;
      const aimTime = U.lerp(0.28, 0.06, t.skill);
      this.setAim(best.tx, best.ty, aimTime + 0.1);
      this.pending.push({ at: now + aimTime, type: 'split', target: best.o, tx: best.tx, ty: best.ty, recheck: t.skill > 0.5 });
      if ((t.tricksplit || (t.skill > 0.7 && Math.random() < 0.3)) && half / 2 >= best.o.mass * 1.3 && best.d > reach * 0.55 && p.cells.length * 4 <= CFG.MAX_CELLS) {
        this.pending.push({ at: now + aimTime + U.rand(0.04, 0.09), type: 'split2' });
      }
      this.lastSplitAt = now;
      return true;
    }

    virusInPath(x0, y0, x1, y1) {
      const dx = x1 - x0, dy = y1 - y0;
      const L2 = dx * dx + dy * dy || 1;
      for (const v of this.nearViruses) {
        let k = ((v.x - x0) * dx + (v.y - y0) * dy) / L2;
        k = U.clamp(k, 0, 1);
        const px = x0 + dx * k, py = y0 + dy * k;
        if (U.dist(px, py, v.x, v.y) < v.r + 30) return true;
      }
      return false;
    }

    considerEscapeSplit(worst, now) {
      const t = this.t, p = this.p;
      if (!worst || worst.danger < 1.25 || t.skill < 0.55) return;
      if (now - this.lastSplitAt < 1.5 || p.cells.length >= CFG.MAX_CELLS) return;
      const m = worst.near;
      if (m.mass < 70) return;
      if (Math.random() > t.splitSkill * 0.25) return;
      const a = Math.atan2(m.y - worst.o.y, m.x - worst.o.x);
      const tx = m.x + Math.cos(a) * 700, ty = m.y + Math.sin(a) * 700;
      this.setAim(tx, ty, 0.25);
      this.pending.push({ at: now + 0.06, type: 'split', tx, ty });
      this.lastSplitAt = now;
    }

    considerPower(maxDanger, prey, now) {
      const p = this.p, t = this.t;
      if (!p.power || this.pending.some(a => a.type === 'power')) return;
      let use = false;
      switch (p.power) {
        case 'shield': use = maxDanger > 0.9; break;
        case 'speed': use = maxDanger > 0.8 || (prey && prey.d < 900); break;
        case 'freeze': use = maxDanger > 0.75 || (prey && prey.d < 650); break;
        case 'magnet': use = this.goal === 'farm' && maxDanger < 0.3; break;
        case 'ghost': use = maxDanger > 0.7 || (p.totalMass > 300 && this.nearViruses.length > 3); break;
        case 'rocket': use = !!prey; break;
      }
      if (use && Math.random() < 0.3 + t.skill * 0.7) {
        this.pending.push({ at: now + U.rand(0.05, 0.3) * (1.5 - t.skill), type: 'power' });
      }
    }

    // Taktik: virüsü besleyip hedefe fırlat
    considerVirusShot(threats, preys, viruses, now) {
      const p = this.p, t = this.t;
      if (t.virusUse * t.skill < 0.25 || now < this.nextPlanAt) return;
      this.nextPlanAt = now + U.rand(2, 5);
      if (Math.random() > t.virusUse) return;
      const big = p.biggest();
      if (p.cells.length > 2 || big.mass < 200) return;
      const cands = [];
      for (const th of threats) if (th.o.mass > 180) cands.push(th.o);
      for (const pr of preys) if (pr.o.mass > 180) cands.push(pr.o);
      if (!cands.length) return;
      let best = null, bestV = 0;
      for (const v of viruses) {
        const dv = U.dist(big.x, big.y, v.x, v.y);
        if (dv > 900) continue;
        const need = CFG.VIRUS_FEEDS - v.feeds;
        if (big.mass - need * CFG.EJECT_LOSS < 120) continue;
        for (const e of cands) {
          if (e.owner.cells.length >= CFG.MAX_CELLS || this.friendly(e.owner)) continue;
          const de = U.dist(v.x, v.y, e.x, e.y);
          if (de > CFG.VIRUS_SHOT_DIST * 0.85 || de < v.r + e.r * 0.3) continue;
          const ux = (e.x - v.x) / de, uy = (e.y - v.y) / de;
          const fx = v.x - ux * (v.r + big.r + 90), fy = v.y - uy * (v.r + big.r + 90);
          const safe = e.mass < big.mass || U.dist(fx, fy, e.x, e.y) - e.r > 300;
          if (!safe) continue;
          const val = e.mass / (de + dv + 400);
          if (val > bestV) { bestV = val; best = { v, e, until: now + 7, stage: 'approach' }; }
        }
      }
      if (best) this.plan = best;
    }

    runPlan(now) {
      const pl = this.plan, p = this.p;
      const v = pl.v, e = pl.e;
      if (v.dead || e.dead || now > pl.until || p.cells.length > 3) { this.plan = null; this.ejectUntil = 0; return false; }
      const big = p.biggest();
      const de = U.dist(v.x, v.y, e.x, e.y);
      if (de > CFG.VIRUS_SHOT_DIST || big.mass < 130) { this.plan = null; this.ejectUntil = 0; return false; }
      const ux = (e.x - v.x) / de, uy = (e.y - v.y) / de;
      const fx = v.x - ux * (v.r + big.r + 70), fy = v.y - uy * (v.r + big.r + 70);
      const dfire = U.dist(big.x, big.y, fx, fy);
      if (pl.stage === 'approach') {
        this.setAim(fx, fy, 0.5);
        this.cursorDist = 200;
        if (dfire < 60 + big.r * 0.3) pl.stage = 'fire';
      } else {
        this.setAim(v.x + ux * 300, v.y + uy * 300, 0.5);
        this.ejectUntil = now + 0.35;
        if (dfire > 260 + big.r) pl.stage = 'approach';
      }
      return true;
    }

    considerFeed(friends, now) {
      const p = this.p, t = this.t, w = this.w;
      if (now < this.nextFeedAt || t.teamwork < 0.5) return;
      this.nextFeedAt = now + U.rand(3, 8);
      const big = p.biggest();
      if (big.mass < 90) return;
      let target = null;
      if (p.team && friends.length) {
        // takım: büyük arkadaşı besle ya da küçüğe yardım et
        let best = 0;
        for (const f of friends) {
          const d = U.dist(big.x, big.y, f.x, f.y);
          if (d > 650) continue;
          const v = f.owner.totalMass > p.totalMass * 2.5 ? 1 : f.owner.totalMass < p.totalMass * 0.2 ? 0.6 : 0;
          if (v > best) { best = v; target = f; }
        }
        if (target && Math.random() > t.teamwork * 0.6) target = null;
      } else if (w.human && w.human.alive && this.friendly(w.human)) {
        const h = w.human;
        const d = U.dist(big.x, big.y, h.cx, h.cy);
        if (d < 700 && h.totalMass < p.totalMass * 0.6 && Math.random() < t.teamwork * 0.5) target = h.biggest();
      }
      if (!target) return;
      this.setAim(target.x, target.y, 1);
      this.ejectUntil = now + U.rand(0.4, 0.9);
      if (Math.random() < 0.5) this.say('feed', 0.3);
    }

    // İnsansı küçük alışkanlıklar
    quirks(now, maxDanger, big) {
      const t = this.t, p = this.p;
      if (t.skill < 0.35 && maxDanger < 0.2) {
        if (Math.random() < 0.004 && big.mass > 40) p.wantEject += U.randInt(1, 3);
        if (Math.random() < 0.003 && big.mass > 40 && p.cells.length < 4) p.wantSplit++;
      }
      if (Math.random() < 0.0025 * t.chat) this.say('random');
      if (p.rank === 1 && Math.random() < 0.01 * t.chat) this.say('top1');
    }
  }

  /* ---------------- Yönetmen: nüfus, zorluk, rakip, sohbet tepkileri ---------------- */
  class AIDirector {
    constructor(w, opts) {
      this.w = w;
      this.opts = opts || {};
      this.difficulty = this.opts.difficulty || 'normal';
      this.ranked = !!this.opts.ranked;
      this.rankTier = this.opts.rankTier || 0;
      this.target = this.opts.botCount || w.mode.bots;
      this.adapt = 0;
      this.adaptTimer = 10;
      this.timers = [];
      this.respawns = [];
      this.pendingJoins = 0;
      this.rival = null;
      this.nextRivalAt = 150;
      this.chatTimer = U.rand(15, 30);
      this.boss = null;
      w.on('eat', e => this.onEat(e));
      w.on('chat', m => this.onChat(m));
      w.on('eventStart', e => this.onEvent(e));
    }

    get dm() {
      if (this.ranked) return 0.82 + this.rankTier * 0.07;
      const d = MG.DIFFICULTIES[this.difficulty] || MG.DIFFICULTIES.normal;
      return d.mul + (this.difficulty === 'adaptive' ? this.adapt : 0);
    }

    mix() {
      if (this.ranked) {
        const tier = this.rankTier;
        const keys = ['easy', 'normal', 'normal', 'hard', 'hard', 'insane', 'insane'];
        return MG.DIFFICULTIES[keys[Math.min(tier, keys.length - 1)]].mix;
      }
      if (this.difficulty === 'adaptive') {
        if (this.adapt < -0.15) return MG.DIFFICULTIES.easy.mix;
        if (this.adapt > 0.2) return MG.DIFFICULTIES.hard.mix;
        return MG.DIFFICULTIES.normal.mix;
      }
      return (MG.DIFFICULTIES[this.difficulty] || MG.DIFFICULTIES.normal).mix;
    }

    later(delay, fn) { this.timers.push({ at: this.w.time + delay, fn }); }

    init() {
      for (let i = 0; i < this.target; i++) this.createBot(true);
    }

    teamColor(team) {
      const base = MG.TEAMS[team].color;
      const v = () => U.randInt(-28, 28);
      return U.makeColor(base[0] + v(), base[1] + v(), base[2] + v());
    }

    createBot(initial) {
      const w = this.w;
      const mix = this.mix();
      const arche = U.weighted(Object.keys(mix).map(k => [k, mix[k]]));
      const team = w.mode.teams ? w.modeCtl.assignTeam() : 0;
      const skinPool = MG.SKINS.filter(s => s.id !== 'none' && !(s.unlock && (s.unlock.ach || s.unlock.rank)));
      const skin = Math.random() < 0.45 ? U.pick(skinPool).id : 'none';
      const p = new MG.Player({
        name: MG.Names.botName(), skin, isBot: true, team,
        color: team ? this.teamColor(team) : U.randomCellColor()
      });
      p.brain = new Brain(p, w, arche, this.dm);
      let mass = w.mods.startMass;
      if (initial && w.mode.respawn && !w.mode.crown) {
        const r = Math.random();
        mass = r < 0.5 ? U.rand(10, 60) : r < 0.8 ? U.rand(60, 300) : r < 0.95 ? U.rand(300, 1200) : U.rand(1200, 3200);
        mass = Math.max(w.mods.startMass, mass * w.mods.botMass);
      } else if (w.mods.botMass > 1 && w.mode.respawn) {
        mass = w.mods.startMass * w.mods.botMass;
      }
      w.spawnPlayer(p, mass);
      p.joinedAt = w.time;
      return p;
    }

    removeBot(p) {
      MG.Names.release(p.name);
      this.w.removePlayer(p);
      if (this.rival === p) this.rival = null;
    }

    spawnBoss() {
      const w = this.w;
      const p = new MG.Player({ name: 'TITAN', color: U.makeColor(150, 40, 255), skin: 'titan', isBot: true });
      p.isBoss = true;
      p.brain = new Brain(p, w, 'boss', 1.05);
      let top = 0;
      for (const q of w.players) if (q.alive && q.totalMass > top) top = q.totalMass;
      const mass = U.clamp(top * 1.15, 2200, 6000);
      let pos = null;
      const h = w.human && w.human.alive ? w.human : null;
      for (let i = 0; i < 12; i++) {
        const c = w.randomPoint(800);
        if (!h || U.dist(c.x, c.y, h.cx, h.cy) > 2500) { pos = c; break; }
      }
      if (!pos) pos = w.randomPoint(800);
      w.spawnPlayer(p, mass, pos.x, pos.y);
      this.boss = p;
      return p;
    }

    onDeath(p, killer) {
      const w = this.w;
      if (killer && killer.brain && Math.random() < killer.brain.t.chat * 0.35) killer.brain.say('ate', U.rand(0.4, 1));
      if (p.isHuman) {
        const life = w.time - p.stats.spawnTime;
        if (this.difficulty === 'adaptive') {
          if (life < 45) this.adapt -= 0.08;
          else if (life < 120) this.adapt -= 0.03;
          else if (life > 300) this.adapt += 0.04;
          this.adapt = U.clamp(this.adapt, -0.35, 0.35);
        }
        if (this.rival && this.rival.brain) { this.rival.brain.focusPlayer = null; this.rival.isRival = false; this.rival = null; }
        return;
      }
      if (p.isBoss) {
        if (killer) {
          killer.stats.titan++;
          w.emit('titanDefeated', { killer });
          w.chat(null, MG.t('system.titanBeaten', { name: killer.name }));
        }
        this.later(0.1, () => w.removePlayer(p));
        this.boss = null;
        return;
      }
      if (p.brain) {
        if (Math.random() < p.brain.t.chat * 0.4) {
          const line = U.pick(MG.Chat.eaten);
          this.later(U.rand(0.8, 2), () => w.chat(p, line));
        }
        if (killer) p.brain.addGrudge(killer, killer.isHuman ? 1.2 : 1);
      }
      if (this.rival === p) { this.rival = null; p.isRival = false; }
      if (!w.modeCtl.canRespawn(p)) return;
      if (Math.random() < 0.08) {
        // oyundan ayrılan ve yeni katılan gerçek oyuncular gibi
        this.later(U.rand(1, 3), () => {
          if (Math.random() < 0.35) w.chat(p, U.pick(MG.Chat.leave));
          this.removeBot(p);
          w.emit('leave', { player: p });
        });
        this.pendingJoins++;
        this.later(U.rand(4, 12), () => {
          this.pendingJoins--;
          const np = this.createBot(false);
          w.emit('join', { player: np });
          if (Math.random() < 0.25) np.brain.say('join', U.rand(1, 3), true);
        });
      } else {
        const fast = p.brain && p.brain.t.skill > 0.8 ? 0.6 : 1;
        this.respawns.push({ at: w.time + U.rand(1.5, 6) * fast, player: p });
      }
    }

    onEat(e) {
      const w = this.w, now = w.time;
      const ep = e.ep, vp = e.vp;
      if (vp.brain) {
        vp.brain.addGrudge(ep, Math.min(1, e.victim.mass / Math.max(20, vp.totalMass + e.victim.mass)) * 0.8);
      }
      // ittifak ihaneti
      if (ep.isAlly(vp, now)) {
        ep.allies.delete(vp.id); vp.allies.delete(ep.id);
        if (vp.brain) { vp.brain.say('betray', U.rand(0.5, 1.2), true); vp.brain.addGrudge(ep, 2); }
        w.emit('allianceBroken', { a: ep, b: vp });
      }
    }

    // İnsanın hızlı sohbet mesajlarına insansı tepkiler
    onChat(m) {
      if (!m.human || !m.intent) return;
      const w = this.w, now = w.time;
      const h = w.human;
      if (!h) return;
      const bots = w.players.filter(p => p.isBot && p.brain && !p.isBoss && p.alive);
      if (!bots.length) return;
      const hx = h.alive ? h.cx : w.size / 2, hy = h.alive ? h.cy : w.size / 2;
      bots.sort((a, b) => U.dist(a.cx, a.cy, hx, hy) - U.dist(b.cx, b.cy, hx, hy));
      const nearby = bots.slice(0, 6);
      switch (m.intent) {
        case 'greet': {
          const n = U.randInt(1, 2);
          for (const b of nearby.filter(b => Math.random() < b.brain.t.chat + 0.2).slice(0, n)) b.brain.say('greetReply', U.rand(0.8, 2.5), true);
          break;
        }
        case 'team': {
          const b = nearby.find(b => U.dist(b.cx, b.cy, hx, hy) < 2600 && !b.isAlly(h, now));
          if (!b) break;
          const t = b.brain.t;
          let pAccept = t.teamwork * 0.75 - t.aggression * 0.3 + 0.2;
          if (h.totalMass > b.totalMass) pAccept += 0.2;
          if (b.brain.grudge(h) > 0) pAccept -= 0.5;
          if (Math.random() < pAccept) {
            const until = now + 150;
            b.allies.set(h.id, until);
            h.allies.set(b.id, until);
            b.brain.say('teamYes', U.rand(0.8, 2), true);
            this.later(1.2, () => w.emit('alliance', { bot: b, human: h }));
          } else {
            b.brain.say('teamNo', U.rand(0.8, 2), true);
          }
          break;
        }
        case 'help': {
          const allies = bots.filter(b => b.isAlly(h, now) || (h.team && b.team === h.team));
          if (allies.length) {
            for (const b of allies.slice(0, 3)) {
              b.brain.helpTarget = h;
              b.brain.helpUntil = now + 20;
              if (Math.random() < 0.6) b.brain.say('helpReply', U.rand(0.5, 1.5), true);
            }
          } else if (nearby[0] && Math.random() < 0.3) {
            nearby[0].brain.say('helpNo', U.rand(1, 2), true);
          }
          break;
        }
        case 'thanks': {
          const b = bots.find(b => b.isAlly(h, now)) || nearby[0];
          if (b && Math.random() < 0.7) b.brain.say('thanksReply', U.rand(0.8, 2), true);
          break;
        }
        case 'gg': {
          for (const b of nearby.filter(() => Math.random() < 0.45).slice(0, 2)) b.brain.say('gg', U.rand(0.8, 2.5), true);
          break;
        }
        case 'taunt': {
          const b = nearby.find(b => b.brain.t.aggression > 0.6);
          if (b) {
            b.brain.say('tauntReply', U.rand(0.8, 2), true);
            b.brain.focusPlayer = h;
            b.brain.focusUntil = now + 30;
          }
          break;
        }
      }
    }

    onEvent(e) {
      const w = this.w;
      const lines = MG.Chat.event[e.id];
      if (!lines) return;
      const bots = w.players.filter(p => p.isBot && p.alive && p.brain && !p.isBoss);
      const n = Math.min(2, bots.length);
      for (let i = 0; i < n; i++) {
        const b = U.pick(bots);
        if (Math.random() < b.brain.t.chat) b.brain.say(lines, U.rand(1, 3.5));
      }
    }

    update(dt) {
      const w = this.w, now = w.time;
      if (this.timers.length) {
        for (let i = this.timers.length - 1; i >= 0; i--) {
          const tm = this.timers[i];
          if (now >= tm.at) { this.timers.splice(i, 1); tm.fn(); }
        }
      }
      if (this.respawns.length) {
        for (let i = this.respawns.length - 1; i >= 0; i--) {
          const r = this.respawns[i];
          if (now < r.at) continue;
          this.respawns.splice(i, 1);
          const p = r.player;
          if (p.alive || w.players.indexOf(p) < 0 || w.over) continue;
          p.brain.rollTraits(this.dm);
          p.brain.onRespawn();
          w.spawnPlayer(p);
        }
      }
      // ölü botlar sohbet satırlarını yine de gönderebilsin
      for (const p of w.players) {
        if (!p.alive && p.brain && p.brain.pending.length) {
          for (let i = p.brain.pending.length - 1; i >= 0; i--) {
            const a = p.brain.pending[i];
            if (a.type === 'chat' && now >= a.at) { p.brain.pending.splice(i, 1); w.chat(p, a.text); }
          }
        }
      }
      if (w.mode.respawn) {
        let bots = 0;
        for (const p of w.players) if (p.isBot && !p.isBoss) bots++;
        if (bots + this.pendingJoins < this.target) {
          this.pendingJoins++;
          this.later(U.rand(1, 4), () => { this.pendingJoins--; const np = this.createBot(false); w.emit('join', { player: np }); });
        }
      }
      this.adaptTimer -= dt;
      if (this.adaptTimer <= 0) {
        this.adaptTimer = 10;
        const h = w.human;
        if (this.difficulty === 'adaptive' && h && h.alive) {
          if (h.rank === 1 && h.totalMass > 800) this.adapt += 0.03;
          else if (h.rank > 0 && h.rank <= 3) this.adapt += 0.015;
          this.adapt = U.clamp(this.adapt, -0.35, 0.35);
        }
        this.checkRival();
      }
      this.chatTimer -= dt;
      if (this.chatTimer <= 0) {
        this.chatTimer = U.rand(18, 40);
        const bots = w.players.filter(p => p.isBot && p.alive && p.brain && !p.isBoss);
        if (bots.length) {
          const b = U.pick(bots);
          if (Math.random() < b.brain.t.chat + 0.2) {
            const pool = w.mode.zone ? MG.Chat.br : w.mode.crown ? MG.Chat.crown : MG.Chat.random;
            b.brain.say(pool, U.rand(0.2, 1));
          }
        }
      }
      if (this.boss && this.boss.alive && this.boss.brain) {
        // Titan en büyük oyuncuyu avlar
        const lb = w.leaderboard.find(e => e.player !== this.boss && e.player.alive);
        if (lb) { this.boss.brain.focusPlayer = lb.player; this.boss.brain.focusUntil = now + 5; }
      }
    }

    // Uzun süre zirvede kalan insana karşı bir "rakip" belirir
    checkRival() {
      const w = this.w, h = w.human, now = w.time;
      if (this.difficulty === 'easy' || !h || !h.alive || this.rival || now < this.nextRivalAt) return;
      if (h.rank !== 1 || h.stats.topTime < 45) return;
      const cands = w.players.filter(p => p.isBot && p.alive && p.brain && !p.isBoss && !p.isAlly(h, now))
        .sort((a, b) => b.totalMass - a.totalMass);
      const b = cands[0];
      if (!b) return;
      b.isRival = true;
      b.brain.focusPlayer = h;
      b.brain.focusUntil = now + 999;
      b.brain.t.aggression = Math.max(b.brain.t.aggression, 0.9);
      b.brain.t.skill = Math.min(1, b.brain.t.skill + 0.15);
      b.brain.t.splitSkill = Math.min(1, b.brain.t.splitSkill + 0.2);
      b.brain.t.reaction *= 0.8;
      this.rival = b;
      this.nextRivalAt = now + 150;
      w.emit('rival', { player: b, target: h });
      b.brain.say('rival', 1.5, true);
    }
  }

  MG.Brain = Brain;
  MG.AIDirector = AIDirector;
})(window.MG = window.MG || {});
