/* MAGGAR.io — ilerleme: XP, seviye, lig puanı, günlük görevler, başarımlar */
(function (MG) {
  'use strict';
  const U = MG.U;

  const ACHIEVEMENTS = [
    { id: 'first_bite', icon: '🍽️', live: s => s.cellsEaten >= 1 },
    { id: 'mass_500', icon: '🌱', live: s => s.peakMass >= 500 },
    { id: 'mass_2000', icon: '🌳', live: s => s.peakMass >= 2000 },
    { id: 'mass_5000', icon: '🏔️', live: s => s.peakMass >= 5000 },
    { id: 'mass_10000', icon: '🪐', live: s => s.peakMass >= 10000 },
    { id: 'top1', icon: '🥇', live: s => s.bestRank === 1 },
    { id: 'hunter10', icon: '🎯', live: s => s.kills >= 10 },
    { id: 'combo3', icon: '⚡', live: s => s.combo >= 3 },
    { id: 'virus_gunner', icon: '🦠', live: s => s.virusShots >= 1 },
    { id: 'survivor', icon: '⏱️', live: s => s.timeAlive >= 600 },
    { id: 'teamplayer', icon: '🤝', live: s => s.feedGiven >= 200 },
    { id: 'titan_slayer', icon: '👾', live: s => s.titan >= 1 },
    { id: 'friend', icon: '💬', live: s => s.allied },
    { id: 'br_win', icon: '🏆', end: s => s.mode === 'royale' && s.won },
    { id: 'crown_win', icon: '👑', end: s => s.mode === 'crown' && s.won },
    { id: 'collector', icon: '🔮', prof: p => p.stats.powerups >= 25 },
    { id: 'event_hunter', icon: '🌪️', prof: p => p.stats.events >= 20 },
    { id: 'marathon', icon: '🎮', prof: p => p.stats.games >= 50 },
    { id: 'gold_league', icon: '🥇', prof: p => p.peakLp >= 600 },
    { id: 'diamond_league', icon: '💎', prof: p => p.peakLp >= 1200 }
  ];

  const MISSIONS = [
    { id: 'mass', vals: [500, 1000, 2000], metric: 'peakMass', agg: 'max', xp: [120, 200, 320] },
    { id: 'cells', vals: [5, 12, 25], metric: 'cellsEaten', agg: 'sum', xp: [120, 200, 300] },
    { id: 'food', vals: [300, 700, 1500], metric: 'food', agg: 'sum', xp: [100, 180, 280] },
    { id: 'survive', vals: [3, 5, 8], metric: 'minutes', agg: 'max', xp: [120, 200, 300] },
    { id: 'power', vals: [3, 6, 10], metric: 'powerups', agg: 'sum', xp: [100, 160, 240] },
    { id: 'top', vals: [10, 5, 1], metric: 'bestRank', agg: 'min', xp: [100, 180, 300] },
    { id: 'feed', vals: [7, 14, 28], metric: 'virusFeeds', agg: 'sum', xp: [100, 160, 240] },
    { id: 'modes', vals: [2, 3], metric: 'modes', agg: 'set', xp: [120, 200] },
    { id: 'events', vals: [2, 4], metric: 'events', agg: 'sum', xp: [120, 200] },
    { id: 'kills', vals: [2, 5, 10], metric: 'kills', agg: 'sum', xp: [140, 220, 340] }
  ];

  for (const a of ACHIEVEMENTS) {
    Object.defineProperty(a, 'name', { get: () => MG.t('ach.' + a.id + '.name'), enumerable: true });
    Object.defineProperty(a, 'desc', { get: () => MG.t('ach.' + a.id + '.desc'), enumerable: true });
  }

  function missionText(m) {
    if (m.id === 'top' && m.target === 1) return MG.t('missions.top1');
    const n = m.id === 'mass' || m.id === 'food' ? U.formatNum(m.target) : m.target;
    return MG.t('missions.' + m.id, { n });
  }

  const DIV = ['III', 'II', 'I'];

  const P = {
    ACHIEVEMENTS,
    profile: null,

    init(profile) {
      this.profile = profile;
      this.ensureMissions();
    },

    save() { MG.Storage.save(this.profile); },

    xpForLevel(l) { return Math.round(150 + 90 * Math.pow(l, 1.35)); },

    levelInfo() {
      const p = this.profile;
      return { level: p.level, xp: p.xp, need: this.xpForLevel(p.level) };
    },

    rankIndex(lp) {
      let idx = 0;
      for (let i = 0; i < MG.RANKS.length; i++) if (lp >= MG.RANKS[i].min) idx = i;
      return idx;
    },

    rankInfo(lp) {
      if (lp === undefined) lp = this.profile.lp;
      const idx = this.rankIndex(lp);
      const r = MG.RANKS[idx];
      const next = MG.RANKS[idx + 1];
      let label = r.name, prog;
      if (next) {
        const span = next.min - r.min;
        const within = lp - r.min;
        const div = Math.min(2, Math.floor(within / (span / 3)));
        label += ' ' + DIV[div];
        prog = within / span;
      } else {
        label += ' • ' + (lp - r.min) + ' LP';
        prog = 1;
      }
      return { idx, rank: r, label, lp, next, prog };
    },

    ensureMissions() {
      const p = this.profile;
      const today = U.todayKey();
      if (p.missions.date === today && p.missions.list.length) return;
      const rng = U.mulberry32(U.hashStr('maggar-' + today));
      const pool = MISSIONS.slice();
      const list = [];
      while (list.length < 3 && pool.length) {
        const i = Math.floor(rng() * pool.length);
        const m = pool.splice(i, 1)[0];
        const vi = Math.floor(rng() * m.vals.length);
        list.push({ id: m.id, target: m.vals[vi], xp: m.xp[vi], progress: m.agg === 'min' ? 999 : 0, done: false });
      }
      p.missions = { date: today, list, modes: [] };
      this.save();
    },

    missionText(m) { return missionText(m); },

    missionProgress(m) {
      const def = MISSIONS.find(d => d.id === m.id);
      if (!def) return 0;
      if (def.agg === 'min') return m.progress <= m.target ? 1 : 0;
      return U.clamp(m.progress / m.target, 0, 1);
    },

    missionLabel(m) {
      const def = MISSIONS.find(d => d.id === m.id);
      if (!def) return '';
      if (def.agg === 'min') return m.progress >= 999 ? '-' : '#' + m.progress;
      return U.formatNum(Math.min(m.progress, m.target)) + ' / ' + U.formatNum(m.target);
    },

    // Oyun sırasında anlık başarımlar
    checkLive(s) {
      const p = this.profile;
      const out = [];
      for (const a of ACHIEVEMENTS) {
        if (!a.live || p.achievements[a.id]) continue;
        if (a.live(s)) { p.achievements[a.id] = Date.now(); out.push(a); }
      }
      if (out.length) this.save();
      return out;
    },

    // Bir hayat/maç bitti: XP, LP, görevler, başarımlar
    finish(s) {
      const p = this.profile;
      this.ensureMissions();
      const report = { xp: 0, breakdown: [], levelUps: 0, lpDelta: 0, rankBefore: null, rankAfter: null, missions: [], achievements: [], unlockedSkins: [] };
      const skinsBefore = this.unlockedSkins();

      const add = (label, v) => { v = Math.round(v); if (v > 0) { report.breakdown.push([label, v]); report.xp += v; } };
      add(MG.t('ui.b_survival'), (s.timeAlive / 60) * 12);
      add(MG.t('ui.b_mass'), Math.min(250, s.peakMass / 25));
      add(MG.t('ui.b_cells'), s.cellsEaten * 6);
      add(MG.t('ui.b_players'), s.kills * 25);
      if (s.mode === 'royale' || s.mode === 'crown') {
        const pl = s.placement || 99;
        add(MG.t('ui.b_place'), pl === 1 ? 250 : pl <= 3 ? 120 : pl <= 10 ? 50 : 10);
      } else {
        add(MG.t('ui.b_place'), s.bestRank === 1 ? 80 : s.bestRank <= 3 ? 50 : s.bestRank <= 10 ? 20 : 0);
      }
      if (s.titan) add(MG.t('ui.b_titan'), 150);
      if (s.ranked) add(MG.t('ui.b_ranked'), report.xp * 0.2);

      // görevler
      const pm = p.missions;
      if (pm.modes.indexOf(s.mode) < 0) pm.modes.push(s.mode);
      const metric = {
        peakMass: s.peakMass, cellsEaten: s.cellsEaten, food: s.food, minutes: Math.floor(s.timeAlive / 60),
        powerups: s.powerups, bestRank: s.mode === 'royale' || s.mode === 'crown' ? Math.min(s.bestRank, s.placement || 999) : s.bestRank,
        virusFeeds: s.virusFeeds, modes: pm.modes.length, events: s.events, kills: s.kills
      };
      for (const m of pm.list) {
        if (m.done) continue;
        const def = MISSIONS.find(d => d.id === m.id);
        if (!def) continue;
        const v = metric[def.metric] || 0;
        if (def.agg === 'sum') m.progress += v;
        else if (def.agg === 'max' || def.agg === 'set') m.progress = Math.max(m.progress, v);
        else if (def.agg === 'min') m.progress = Math.min(m.progress, v || 999);
        const ok = def.agg === 'min' ? m.progress <= m.target : m.progress >= m.target;
        if (ok) {
          m.done = true;
          report.missions.push({ text: this.missionText(m), xp: m.xp });
          add(MG.t('ui.b_mission', { text: this.missionText(m) }), m.xp);
        }
      }

      // genel istatistikler
      const st = p.stats;
      st.games++;
      st.timePlayed += s.timeAlive;
      st.foodEaten += s.food;
      st.cellsEaten += s.cellsEaten;
      st.kills += s.kills;
      st.massEaten += s.massEaten || 0;
      st.highestMass = Math.max(st.highestMass, s.peakMass);
      st.powerups += s.powerups;
      st.events += s.events;
      st.virusFeeds += s.virusFeeds;
      st.longestLife = Math.max(st.longestLife, s.timeAlive);
      st.titanKills += s.titan || 0;
      if (!s.won || s.mode !== 'royale') st.deaths++;
      if (s.bestRank === 1 || s.won) st.top1++;
      if (s.mode === 'royale' && s.won) st.brWins++;
      if (s.mode === 'crown' && s.won) st.crownWins++;

      // lig puanı
      if (s.ranked) {
        report.rankBefore = this.rankInfo(p.lp);
        const tier = report.rankBefore.idx;
        let d;
        if (s.mode === 'royale' || s.mode === 'crown') {
          const N = Math.max(2, s.players || 30), pl = s.placement || N;
          d = Math.round(30 - (pl - 1) * (55 / (N - 1)));
        } else {
          d = s.bestRank === 1 ? 22 : s.bestRank <= 3 ? 14 : s.bestRank <= 10 ? 6 : -6;
          d += Math.min(8, s.kills * 2);
          d += Math.min(6, Math.floor(s.peakMass / 1000) * 2);
          if (s.timeAlive < 30) d -= 6;
        }
        if (d > 0) d = Math.round(d * (1 - tier * 0.06));
        else d = Math.round(d * (1 + tier * 0.1));
        d = U.clamp(d, -25, 40);
        p.lp = Math.max(0, p.lp + d);
        p.peakLp = Math.max(p.peakLp, p.lp);
        p.rankedGames++;
        report.lpDelta = d;
        report.rankAfter = this.rankInfo(p.lp);
      }

      // başarımlar
      for (const a of ACHIEVEMENTS) {
        if (p.achievements[a.id]) continue;
        let ok = false;
        if (a.live) ok = a.live(s);
        if (!ok && a.end) ok = a.end(s);
        if (!ok && a.prof) ok = a.prof(p);
        if (ok) { p.achievements[a.id] = Date.now(); report.achievements.push(a); }
      }

      // XP ve seviye
      p.xp += report.xp;
      while (p.xp >= this.xpForLevel(p.level)) {
        p.xp -= this.xpForLevel(p.level);
        p.level++;
        report.levelUps++;
      }

      // maç geçmişi
      p.history.unshift({
        mode: s.mode, mass: Math.round(s.peakMass), rank: s.placement || s.bestRank, kills: s.kills,
        time: Math.round(s.timeAlive), date: Date.now(), lp: report.lpDelta, ranked: !!s.ranked
      });
      if (p.history.length > 15) p.history.length = 15;

      const after = this.unlockedSkins();
      report.unlockedSkins = after.filter(id => skinsBefore.indexOf(id) < 0);
      this.save();
      return report;
    },

    isSkinUnlocked(skin) {
      const u = skin.unlock;
      if (!u) return true;
      const p = this.profile;
      if (u.level) return p.level >= u.level;
      if (u.rank) {
        const need = MG.RANKS.findIndex(r => r.id === u.rank);
        return this.rankIndex(p.peakLp) >= need;
      }
      if (u.ach) return !!p.achievements[u.ach];
      return false;
    },

    unlockText(skin) {
      const u = skin.unlock;
      if (!u) return '';
      if (u.level) return MG.t('ui.unlockLevel', { n: u.level });
      if (u.rank) { const r = MG.RANKS.find(x => x.id === u.rank); return MG.t('ui.unlockRank', { name: r ? r.name : u.rank }); }
      if (u.ach) { const a = ACHIEVEMENTS.find(x => x.id === u.ach); return MG.t('ui.unlockAch', { name: a ? a.name : u.ach }); }
      return '';
    },

    unlockedSkins() {
      return MG.SKINS.filter(s => this.isSkinUnlocked(s)).map(s => s.id);
    }
  };

  MG.Progress = P;
})(window.MG = window.MG || {});
