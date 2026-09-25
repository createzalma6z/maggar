/* MAGGAR.io — ana oyun denetleyicisi */
(function (MG) {
  'use strict';
  const U = MG.U;
  const UI = MG.UI;
  const t = (k, v) => MG.t(k, v);

  class Game {
    constructor() {
      this.profile = MG.Storage.load();
      MG.Progress.init(this.profile);
      this.settings = this.profile.settings;
      MG.I18N.set(this.settings.lang || 'en');
      this.cv = document.getElementById('game');
      this.renderer = new MG.Renderer(this.cv, this.settings);
      this.state = 'menu';
      this.world = null;
      this.me = null;
      this.cam = { x: 0, y: 0, zoom: 0.5 };
      this.userZoom = 1;
      this.selectedMode = MG.MODES[this.profile.lastMode] ? this.profile.lastMode : 'classic';
      this.spectateTarget = null;
      this.menuTarget = null;
      this.menuSwitchAt = 0;
      this.last = 0;
      this.fps = 60;
      this.lowFpsTime = 0;
      this.liveTimer = 1;
      this.infoTimer = 0;
      this.deathTimer = 0;
      this.lifeRecorded = false;
      this.alliedThisLife = false;
      this.rankedActive = false;
      this.pendingMatchEnd = null;
      this.tutorialQueue = [];
      this.tutorialTimer = 0;

      MG.Audio.enabled = this.settings.sound;
      MG.Audio.setVolume(this.settings.volume);
      if (this.settings.quality === 'low') this.renderer.setLowQuality(true);

      this.input = new MG.Input(this.cv, {
        any: () => MG.Audio.init(),
        split: () => this.act('split'),
        doubleSplit: () => this.act('double'),
        quadSplit: () => this.act('quad'),
        eject: down => { if (this.me) this.me.ejecting = !!down && this.state === 'playing'; },
        power: () => this.usePower(),
        escape: () => this.onEscape(),
        enter: () => this.onEnter(),
        chat: i => this.quickChat(i),
        toggleChat: () => UI.toggleQuickChat(),
        toggleMinimap: () => { this.settings.showMinimap = !this.settings.showMinimap; UI.applySettings(); this.saveProfile(); },
        zoom: d => { this.userZoom = U.clamp(this.userZoom * (d > 0 ? 1.1 : 0.9), 0.55, 1.8); }
      });

      window.addEventListener('resize', () => this.renderer.resize());
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.state === 'playing') this.pause();
      });
    }

    boot() {
      UI.init(this);
      this.newWorld(this.selectedMode);
      UI.renderLiveInfo(this.world);
      const loader = document.getElementById('loading');
      if (loader) loader.remove();
      requestAnimationFrame(t => this.loop(t));
    }

    saveProfile() { MG.Storage.save(this.profile); }

    setLanguage(lang) {
      this.settings.lang = lang;
      MG.I18N.set(lang);
      this.saveProfile();
      UI.applyLanguage();
    }

    rankedFor(modeId) { return !!this.profile.ranked && !!MG.MODES[modeId].ranked; }

    pickMutators() {
      const pool = MG.MUTATORS.slice();
      if (!this.settings.powerups) {
        const i = pool.findIndex(m => m.id === 'powersurge');
        if (i >= 0) pool.splice(i, 1);
      }
      if (!this.settings.events) {
        const i = pool.findIndex(m => m.id === 'chaos');
        if (i >= 0) pool.splice(i, 1);
      }
      U.shuffle(pool);
      return pool.slice(0, Math.random() < 0.45 ? 2 : 1);
    }

    newWorld(modeId) {
      const mode = MG.MODES[modeId];
      const ranked = this.rankedFor(modeId);
      const opts = {
        mode: modeId,
        difficulty: ranked ? 'normal' : this.settings.difficulty,
        botCount: ranked ? 0 : this.settings.botCount || 0,
        arena: ranked ? 'random' : this.settings.arena,
        events: this.settings.events,
        powerups: this.settings.powerups,
        darkClassic: this.settings.darkClassic,
        mutators: mode.mutators ? this.pickMutators() : [],
        ranked,
        rankTier: MG.Progress.rankInfo().idx
      };
      this.world = new MG.World(opts);
      this.world.rankedFlag = ranked;
      this.world.settingsKey = this.worldKey(modeId);
      this.renderer.attach(this.world);
      this.bindWorld(this.world);
      this.me = null;
      this.menuTarget = null;
      this.pendingMatchEnd = null;
      document.body.classList.toggle('classic-hud', !!this.world.arena.light || this.world.arena.id === 'classicDark');
      const c = this.world.size / 2;
      this.cam.x = c; this.cam.y = c;
      return this.world;
    }

    worldKey(modeId) {
      const s = this.settings;
      return [modeId, this.rankedFor(modeId), s.difficulty, s.botCount, s.arena, s.events, s.powerups, s.darkClassic].join('|');
    }

    refreshBackgroundWorld() {
      if (this.state !== 'menu') return;
      if (this.world && this.world.settingsKey === this.worldKey(this.selectedMode)) return;
      UI.clearHud();
      this.newWorld(this.selectedMode);
      UI.renderLiveInfo(this.world);
    }

    selectMode(id) {
      if (!MG.MODES[id]) return;
      this.selectedMode = id;
      this.profile.lastMode = id;
      this.saveProfile();
      UI.renderModes();
      if (this.state === 'menu') {
        UI.clearHud();
        this.newWorld(id);
        UI.renderLiveInfo(this.world);
      }
    }

    /* ---------- dünya olayları ---------- */
    bindWorld(w) {
      const me = () => this.me;
      const nm = p => '<b style="color:' + p.color.hex + '">' + U.escapeHtml(p.name || t('ui.unnamed')) + '</b>';
      w.on('eat', e => {
        if (e.ep === me()) {
          MG.Audio.play('eat');
          const ct = e.ep.comboTimes;
          if (e.last && ct.length >= 2) UI.announce(ct.length >= 3 ? t('ui.combo', { n: ct.length }) : t('ui.double'));
        }
      });
      w.on('death', e => {
        const p = e.player, k = e.killer;
        if (p === me()) { this.onMyDeath(e); return; }
        if (k === me()) {
          UI.killfeed(t('ui.youAte', { name: nm(p) }), 'me');
          if (p.isBoss) UI.announce(t('ui.titanDown'));
          else if (p.isRival) UI.announce(t('ui.rivalBeaten'), true);
        } else if (k && (p.rank <= 5 || p.isBoss) && Math.random() < 0.8) {
          UI.killfeed(t('ui.ateFeed', { a: nm(k), b: nm(p) }));
        } else if (e.cause === 'zone' && Math.random() < 0.5) {
          UI.killfeed(t('ui.melted', { name: nm(p) }), 'bad');
        }
      });
      w.on('virusPop', e => {
        if (e.player === me()) MG.Audio.play('pop');
        if (e.shooter && e.shooter === me() && e.player !== me()) { UI.announce(t('ui.virusHit'), true); MG.Audio.play('achievement'); }
      });
      w.on('split', e => { if (e.player === me()) MG.Audio.play('split'); });
      w.on('eject', e => { if (e.player === me()) MG.Audio.play('eject'); });
      w.on('powerup', e => { if (e.player === me()) MG.Audio.play('power'); });
      w.on('power', e => { if (e.player === me()) MG.Audio.play('use'); });
      w.on('freeze', e => {
        const m = me();
        if (m && m.alive && e.player !== m && m.effects.frozen > 3.3) UI.announce(t('ui.frozenBy', { name: e.player.name || t('ui.someone') }), true);
      });
      w.on('teleport', e => { if (e.cell.owner === me()) MG.Audio.play('teleport'); });
      w.on('meteorImpact', e => {
        const m = me();
        if (m && m.alive && U.dist(e.hazard.x, e.hazard.y, m.cx, m.cy) < 1500) MG.Audio.play('meteor');
      });
      w.on('eventStart', e => {
        if (this.state === 'menu') return;
        MG.Audio.play('event');
        UI.announce(e.def.icon + ' ' + e.def.name.toLocaleUpperCase(MG.I18N.lang === 'tr' ? 'tr-TR' : 'en-US'));
        w.chat(null, t('ui.eventMsg', { icon: e.def.icon, name: e.def.name, desc: e.def.desc }));
      });
      w.on('chat', m => {
        if (this.state === 'menu' && !m.system) return;
        UI.addChat(m);
        if (!m.system && !m.human && this.state === 'playing') MG.Audio.play('chat');
      });
      w.on('join', e => { if (this.state !== 'menu' && Math.random() < 0.3) w.chat(null, t('ui.joined', { name: e.player.name })); });
      w.on('alliance', e => {
        if (e.human !== me()) return;
        this.alliedThisLife = true;
        UI.announce(t('ui.teamedWith', { name: e.bot.name }), true);
        MG.Audio.play('achievement');
      });
      w.on('allianceBroken', e => {
        const m = me();
        if (e.a === m || e.b === m) UI.announce(t('ui.teamBroken'), true);
      });
      w.on('rival', e => {
        if (e.target !== me()) return;
        MG.Audio.play('alarm');
        UI.announce(t('ui.rivalPicked', { name: e.player.name }), true);
      });
      w.on('titanDefeated', e => { if (e.killer === me()) MG.Audio.play('win'); });
      w.on('crown', e => {
        const m = me();
        if (!m || this.state === 'menu') return;
        if (e.player === m) { UI.announce(t('ui.crownYou')); MG.Audio.play('power'); }
        else if (e.stolen && e.from === m) UI.announce(t('ui.crownStolen'), true);
      });
      w.on('zone', e => {
        if (this.state === 'menu') return;
        if (e.state === 'shrink') { UI.announce(t('ui.zoneShrinkAnn'), true); MG.Audio.play('alarm'); }
        else if (e.state === 'final') UI.announce(t('ui.finalZoneAnn'), true);
      });
      w.on('matchEnd', r => this.onMatchEnd(r));
    }

    /* ---------- oynanış ---------- */
    validateName() {
      const raw = document.getElementById('nick').value;
      const clean = MG.Filter.clean(raw);
      if (clean === null) {
        UI.nickWarning(t('ui.nameBad'));
        return null;
      }
      return clean;
    }

    play() {
      MG.Audio.init();
      const name = this.validateName();
      if (name === null) return;
      this.profile.name = name;
      this.saveProfile();

      const modeId = this.selectedMode;
      const mode = MG.MODES[modeId];
      const w = this.world;
      const inWorld = !!(w && this.me && w.players.indexOf(this.me) >= 0);
      const reuse = w && w.modeId === modeId && !w.over && w.settingsKey === this.worldKey(modeId) &&
        (mode.persistent || (mode.crown && inWorld));
      if (!reuse) this.newWorld(modeId);

      const world = this.world;
      const skin = MG.SKINS.some(s => s.id === this.profile.skin && MG.Progress.isSkinUnlocked(s)) ? this.profile.skin : 'none';
      let me = reuse && inWorld && !this.me.alive ? this.me : null;
      if (me) {
        // aynı maçta yeniden doğ (taç puanı ve ittifaklar korunur)
        me.name = name;
        me.skin = skin;
        if (!me.team) me.color = this.profile.color ? U.fromHex(this.profile.color) : U.randomCellColor();
      } else {
        if (reuse && inWorld) world.removePlayer(this.me);
        const team = world.mode.teams ? world.modeCtl.assignTeam() : 0;
        let color;
        if (team) color = world.director.teamColor(team);
        else color = this.profile.color ? U.fromHex(this.profile.color) : U.randomCellColor();
        me = new MG.Player({ name, color, skin, isHuman: true, team });
      }
      this.me = me;
      world.human = me;
      world.spawnPlayer(me);
      this.rankedActive = world.rankedFlag;
      this.lifeRecorded = false;
      this.alliedThisLife = false;
      this.pendingMatchEnd = null;
      this.userZoom = 1;
      this.spectateTarget = null;
      this.cam.x = me.cx; this.cam.y = me.cy;

      this.state = 'playing';
      this.input.active = true;
      UI.showMenu(false);
      UI.showDeathScreen(false);
      UI.showPause(false);
      UI.showSpectateBar(false);
      UI.showHud(true);
      UI.clearHud();
      UI.lastScore = -1;
      if (world.mutators.length) {
        world.chat(null, t('ui.matchRules', { list: world.mutators.map(m => m.icon + ' ' + m.name).join(', ') }));
      }
      world.chat(null, t('ui.arenaMsg', { name: world.arena.name }) + (this.rankedActive ? t('ui.rankedMatch') : ''));
      if (!this.profile.tutorialDone) this.startTutorial();
      else if (mode.zone) UI.announce(t('ui.lastCell'));
      else if (mode.crown) UI.announce(t('ui.grabCrown'));
    }

    startTutorial() {
      this.tutorialQueue = t('ui.tutorial').slice();
      if (this.input.isTouch) this.tutorialQueue[0] = t('ui.tutorialTouch');
      this.tutorialTimer = 1;
      this.profile.tutorialDone = true;
      this.saveProfile();
    }

    act(kind) {
      const me = this.me;
      if (this.state !== 'playing' || !me || !me.alive) return;
      if (kind === 'split') me.wantSplit++;
      else if (kind === 'double') me.wantSplit += 2;
      else if (kind === 'quad') me.wantSplit += 4;
    }

    usePower() {
      const me = this.me;
      if (this.state !== 'playing' || !me || !me.alive || !me.power) return;
      me.wantPower = true;
    }

    quickChat(i) {
      const q = MG.QUICK_CHAT[i];
      if (!q || !this.world || this.state === 'menu') return;
      const now = performance.now();
      if (this.lastChatAt && now - this.lastChatAt < 1500) return;
      this.lastChatAt = now;
      const me = this.me;
      if (!me) return;
      this.world.chat(me, q.text, { intent: q.intent });
    }

    onEscape() {
      if (UI.isModalOpen()) { UI.closeModal(); return; }
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
      else if (this.state === 'spectate') this.toMenu();
    }

    onEnter() {
      if (UI.isModalOpen()) return;
      if (this.state === 'menu' || this.state === 'dead') this.play();
    }

    pause() {
      if (this.state !== 'playing') return;
      this.state = 'paused';
      if (this.me) this.me.ejecting = false;
      UI.showPause(true);
    }

    resume() {
      if (this.state !== 'paused') return;
      this.state = 'playing';
      UI.showPause(false);
      this.last = performance.now();
    }

    quitMatch() {
      UI.showPause(false);
      const me = this.me;
      if (me && me.alive && !this.lifeRecorded) {
        this.recordLife(me, {});
        this.world.removePlayer(me);
      }
      this.toMenu();
    }

    toMenu() {
      this.state = 'menu';
      this.input.active = false;
      UI.showHud(false);
      UI.showDeathScreen(false);
      UI.showPause(false);
      UI.showSpectateBar(false);
      UI.showMenu(true);
      UI.clearHud();
      this.spectateTarget = null;
      const w = this.world;
      const needNew = !w || w.over || !MG.MODES[w.modeId].persistent || w.modeId !== this.selectedMode ||
        w.settingsKey !== this.worldKey(this.selectedMode) || w.time > 900;
      if (needNew) this.newWorld(this.selectedMode);
      else if (this.me && !this.me.alive) { this.world.removePlayer(this.me); this.me = null; this.world.human = null; }
      UI.renderLiveInfo(this.world);
    }

    startSpectate(fromDeath) {
      this.state = 'spectate';
      this.input.active = false;
      UI.showMenu(false);
      UI.showDeathScreen(false);
      UI.showHud(true);
      const w = this.world;
      let target = null;
      if (fromDeath && this.me && this.me.lastEatenBy && this.me.lastEatenBy.alive) target = this.me.lastEatenBy;
      if (!target) { const top = w.leaderboard.find(e => e.player.alive); target = top ? top.player : null; }
      this.spectateTarget = target;
      UI.showSpectateBar(true, target ? target.name : '');
    }

    onMyDeath(e) {
      MG.Audio.play('death');
      if (this.me) this.me.ejecting = false;
      this.input.active = false;
      this.deathInfo = e;
      this.deathTimer = 1.4;
      this.state = 'dying';
    }

    // Bir hayatı ilerlemeye işle
    recordLife(p, extra) {
      if (this.lifeRecorded) return null;
      this.lifeRecorded = true;
      const w = this.world;
      const s = p.stats;
      const end = p.alive ? w.time : s.deathTime || w.time;
      const summary = Object.assign({
        mode: w.modeId,
        ranked: this.rankedActive && !(w.mode.crown && !extra.matchEnd),
        timeAlive: Math.max(0, end - s.spawnTime),
        peakMass: s.highestMass, food: s.food, cellsEaten: s.cellsEaten, kills: s.kills, massEaten: s.massEaten,
        bestRank: s.bestRank, topTime: s.topTime, powerups: s.powerups, virusFeeds: s.virusFeeds, virusShots: s.virusShots,
        events: s.events, combo: s.comboBest, feedGiven: s.feedGiven, titan: s.titan, allied: this.alliedThisLife,
        placement: p.placement || 0, won: false, players: w.players.filter(q => !q.isBoss).length
      }, extra || {});
      const report = MG.Progress.finish(summary);
      this.announceReport(report);
      return { summary, report };
    }

    announceReport(report) {
      let delay = 400;
      for (const a of report.achievements) {
        setTimeout(() => { UI.toast(a.icon, t('ui.achievement', { name: a.name }), a.desc); MG.Audio.play('achievement'); }, delay);
        delay += 900;
      }
      if (report.levelUps) setTimeout(() => { UI.toast('⬆️', t('ui.levelUp', { n: this.profile.level })); MG.Audio.play('level'); }, delay);
      for (const id of report.unlockedSkins) {
        const s = MG.SKINS.find(x => x.id === id);
        delay += 700;
        setTimeout(() => UI.toast('🎁', t('ui.newSkin', { name: s.name })), delay);
      }
    }

    showDeathScreen() {
      const w = this.world, me = this.me, e = this.deathInfo;
      const s = me.stats;
      const isBR = w.mode.zone;
      const res = this.recordLife(me, {});
      const life = Math.max(0, (s.deathTime || w.time) - s.spawnTime);
      let title = t('ui.eaten');
      let sub = '';
      if (e && e.killer) sub = t('ui.eatenBy', { name: '<b style="color:' + e.killer.color.hex + '">' + U.escapeHtml(e.killer.name || t('ui.unnamed')) + '</b>' }) + (e.killer.brain ? ' <span class="muted">(' + e.killer.brain.label + ')</span>' : '');
      else if (e && e.cause === 'zone') { title = t('ui.zoneDeath'); sub = t('ui.zoneTip'); }
      if (isBR) sub += (sub ? '<br>' : '') + t('ui.placement', { p: me.placement || '?', n: res ? res.summary.players : '' });
      const stats = [
        [t('ui.highestMass'), U.formatNum(s.highestMass)],
        [t('ui.foodEaten'), U.formatNum(s.food)],
        [t('ui.timeAlive'), U.formatTime(life)],
        [t('ui.cellsEaten'), String(s.cellsEaten)],
        [t('ui.bestRank'), s.bestRank >= 999 ? '-' : '#' + s.bestRank],
        [t('ui.timeOnTop'), U.formatTime(s.topTime)]
      ];
      UI.showDeath({
        title, sub, stats, report: res && res.report,
        canWatch: w.players.some(p => p.alive),
        againText: w.mode.persistent || (w.mode.crown && !w.over) ? t('ui.playAgain') : t('ui.newMatch')
      });
      this.state = 'dead';
      UI.renderMenu();
    }

    onMatchEnd(r) {
      if (!this.me || this.state === 'menu') return;
      const me = this.me;
      const won = r.winner === me;
      const place = me.placement || (r.placements.indexOf(me) + 1) || r.placements.length;
      if (won) { MG.Audio.play('win'); UI.announce(r.mode === 'royale' ? t('ui.brWin') : t('ui.crownWin')); }
      const finish = () => {
        this.input.active = false;
        let res;
        if (!this.lifeRecorded) res = this.recordLife(me, { placement: place, won, matchEnd: true });
        else if (r.mode === 'crown') {
          // ölüyken biten taç maçı: yalnızca sıralama ödülü
          this.lifeRecorded = false;
          res = this.recordLife(me, { placement: place, won, matchEnd: true, timeAlive: 0, peakMass: 0, food: 0, cellsEaten: 0, kills: 0, powerups: 0, virusFeeds: 0, events: 0 });
        }
        const wn = r.winner ? r.winner.name : '-';
        const stats = r.mode === 'crown'
          ? [[t('ui.placementL'), '#' + place], [t('ui.crownPts'), String(Math.floor(me.crownPoints))], [t('ui.winner'), wn],
            [t('ui.highestMass'), U.formatNum(me.stats.highestMass)], [t('ui.cellsEaten'), String(me.stats.cellsEaten)], [t('ui.playersL'), String(r.placements.length)]]
          : [[t('ui.placementL'), '#' + place], [t('ui.highestMass'), U.formatNum(me.stats.highestMass)], [t('ui.cellsEaten'), String(me.stats.cellsEaten)],
            [t('ui.foodEaten'), U.formatNum(me.stats.food)], [t('ui.playersL'), String(r.placements.length)], [t('ui.winner'), wn]];
        UI.showDeath({
          title: won ? (r.mode === 'royale' ? t('ui.victory') : t('ui.crownYours')) : t('ui.matchOver'),
          sub: won ? t('ui.greatGame') : t('ui.winnerIs', { name: U.escapeHtml(wn) }),
          stats, report: res && res.report, canWatch: false, againText: t('ui.newMatch')
        });
        this.state = 'dead';
      };
      if (this.state === 'dead' || this.state === 'dying') {
        if (r.mode === 'crown') setTimeout(finish, 600);
        return;
      }
      setTimeout(finish, won ? 1800 : 600);
      this.state = 'ending';
    }

    onSettingsChanged(k) {
      const s = this.settings;
      if (k === 'sound') MG.Audio.enabled = s.sound;
      if (k === 'volume') MG.Audio.setVolume(s.volume);
      if (k === 'quality') this.renderer.setLowQuality(s.quality === 'low');
      if (k === 'darkClassic' && this.world && this.world.arena.light !== undefined && MG.MODES[this.world.modeId].arena === 'classic' && this.state === 'menu') {
        this.newWorld(this.selectedMode);
      }
      UI.applySettings();
      this.saveProfile();
      if (this.state === 'menu' && (k === 'events' || k === 'powerups' || k === 'botCount')) this.refreshBackgroundWorld();
    }

    resetProfile() {
      const keepSettings = Object.assign({}, this.settings);
      this.profile = MG.Storage.reset();
      this.profile.settings = Object.assign(this.profile.settings, keepSettings);
      this.settings = this.profile.settings;
      this.renderer.settings = this.settings;
      MG.Progress.init(this.profile);
      this.saveProfile();
      UI.closeModal();
      UI.renderMenu();
      UI.toast('🧹', t('ui.profileReset'));
    }

    /* ---------- kamera ---------- */
    updateCamera(dt) {
      const w = this.world, cam = this.cam;
      const scale = this.renderer.screenScale();
      let tx = cam.x, ty = cam.y, tz = cam.zoom;
      const me = this.me;
      if (me && me.alive && (this.state === 'playing' || this.state === 'paused' || this.state === 'dying' || this.state === 'ending')) {
        tx = me.cx; ty = me.cy;
        tz = w.viewZoom(me) * scale * this.userZoom;
      } else if (this.state === 'spectate' || this.state === 'dead' || this.state === 'dying') {
        let t = this.spectateTarget;
        if (!t || !t.alive) {
          const top = w.leaderboard.find(e => e.player.alive);
          t = this.spectateTarget = top ? top.player : null;
          if (t && this.state === 'spectate') UI.showSpectateBar(true, t.name);
        }
        if (t) { tx = t.cx; ty = t.cy; tz = w.viewZoom(t) * scale * 0.85; }
      } else {
        // menü: rastgele bir oyuncuyu sinematik takip
        let t = this.menuTarget;
        if (!t || !t.alive || w.time > this.menuSwitchAt) {
          const alive = w.players.filter(p => p.alive && p.totalMass > 60);
          t = this.menuTarget = alive.length ? U.pick(alive) : null;
          this.menuSwitchAt = w.time + U.rand(14, 22);
        }
        if (t) { tx = t.cx; ty = t.cy; tz = Math.min(0.9, w.viewZoom(t)) * scale * 0.75; }
      }
      const k = 1 - Math.exp(-dt * 7);
      cam.x += (tx - cam.x) * k;
      cam.y += (ty - cam.y) * k;
      cam.zoom += (tz - cam.zoom) * (1 - Math.exp(-dt * 3.5));
    }

    applyMouse() {
      const me = this.me;
      if (!me || !me.alive || this.state !== 'playing') return;
      const t = this.input.screenTarget();
      const cam = this.cam, W = this.renderer.w, H = this.renderer.h;
      me.targetX = cam.x + (t.x - W / 2) / cam.zoom;
      me.targetY = cam.y + (t.y - H / 2) / cam.zoom;
    }

    liveSnapshot(me) {
      const s = me.stats, w = this.world;
      return {
        mode: w.modeId, cellsEaten: s.cellsEaten, peakMass: s.highestMass, bestRank: s.bestRank, kills: s.kills, combo: s.comboBest,
        virusShots: s.virusShots, timeAlive: w.time - s.spawnTime, feedGiven: s.feedGiven, titan: s.titan, allied: this.alliedThisLife
      };
    }

    /* ---------- döngü ---------- */
    loop(ts) {
      requestAnimationFrame(t => this.loop(t));
      if (!this.last) this.last = ts;
      let dt = (ts - this.last) / 1000;
      this.last = ts;
      if (dt > 0.1) dt = 0.1;
      if (dt <= 0) return;
      this.fps += (1 / dt - this.fps) * 0.05;
      const w = this.world;
      if (!w) return;

      if (this.state !== 'paused') {
        this.applyMouse();
        w.step(dt);
      }
      if (w.humanFood > 0) { MG.Audio.play('pellet'); w.humanFood = 0; }

      if (this.state === 'dying') {
        this.deathTimer -= dt;
        if (this.deathTimer <= 0) this.showDeathScreen();
      }

      if (this.state === 'playing' && this.me && this.me.alive) {
        this.liveTimer -= dt;
        if (this.liveTimer <= 0) {
          this.liveTimer = 1;
          const got = MG.Progress.checkLive(this.liveSnapshot(this.me));
          for (const a of got) { UI.toast(a.icon, t('ui.achievement', { name: a.name }), a.desc); MG.Audio.play('achievement'); }
        }
        if (this.tutorialQueue.length) {
          this.tutorialTimer -= dt;
          if (this.tutorialTimer <= 0) {
            const t = this.tutorialQueue.shift();
            UI.toast(t[0], t[1], t[2]);
            this.tutorialTimer = 4.2;
          }
        }
      }

      if (this.state === 'menu') {
        this.infoTimer -= dt;
        if (this.infoTimer <= 0) { this.infoTimer = 2; UI.renderLiveInfo(w); }
      }

      // otomatik kalite
      if (this.settings.quality === 'auto' && this.state === 'playing') {
        if (this.fps < 38) this.lowFpsTime += dt; else this.lowFpsTime = Math.max(0, this.lowFpsTime - dt * 0.5);
        if (this.lowFpsTime > 4 && !this.renderer.lowQuality) {
          this.renderer.setLowQuality(true);
          UI.toast('⚙️', t('ui.perfMode'), t('ui.perfModeSub'));
        }
      }

      this.updateCamera(dt);
      const viewer = this.state === 'playing' || this.state === 'dying' || this.state === 'paused' || this.state === 'ending' ? this.me : null;
      this.renderer.render(w, this.cam, viewer, dt);
      if (this.state !== 'menu') UI.update(dt, w, this.me, this.cam, this.fps);
    }
  }

  function start() {
    try {
      const g = new Game();
      MG.game = g;
      g.boot();
    } catch (err) {
      console.error(err);
      const d = document.createElement('div');
      d.className = 'noscript';
      d.textContent = 'Game failed to start: ' + err.message;
      document.body.appendChild(d);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window.MG = window.MG || {});
