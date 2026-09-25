/* MAGGAR.io — menus, in-game HUD, modals */
(function (MG) {
  'use strict';
  const U = MG.U;
  const t = (k, v) => MG.t(k, v);
  const $ = id => document.getElementById(id);
  const esc = s => U.escapeHtml(s);

  const COLOR_SWATCHES = ['#ff0707', '#ff8c07', '#ffe607', '#9dff07', '#07ff4a', '#07ffd5', '#07c3ff', '#0766ff', '#6a07ff', '#d507ff', '#ff07b5', '#ff0762'];

  const UI = {
    game: null,
    els: {},
    lbTimer: 0,
    miniTimer: 0,
    lastScore: -1,
    modalType: null,
    lastLbHtml: '',

    init(game) {
      this.game = game;
      const ids = ['menu', 'hud', 'death', 'pause', 'modal', 'modal-body', 'toasts', 'nick', 'nick-warn', 'skin-btn', 'play-btn',
        'modes', 'mode-info', 'ranked-toggle', 'difficulty', 'arena-select', 'arena-wrap', 'profile-card', 'missions', 'mission-reset',
        'live-info', 'score-val', 'hud-stats', 'killfeed', 'lb-list', 'lb-title', 'team-pie', 'mode-bar', 'event-banner', 'announce',
        'effects', 'chat-log', 'quickchat', 'power-slot', 'power-icon', 'power-name', 'minimap', 'touch-ui', 'death-title', 'death-sub',
        'death-stats', 'death-rewards', 'again-btn', 'watch-btn', 'menu-btn', 'resume-btn', 'quit-btn', 'spectate-btn', 'spectate-bar',
        'spectate-name', 'spectate-exit', 'pause-btn', 'leaderboard', 'lang-switch'];
      for (const id of ids) this.els[id] = $(id);
      const E = this.els;
      const g = game;

      E.modes.addEventListener('click', e => {
        const b = e.target.closest('.mode-card');
        if (!b) return;
        MG.Audio.play('click');
        g.selectMode(b.dataset.mode);
      });
      E.difficulty.addEventListener('change', () => { g.settings.difficulty = E.difficulty.value; g.saveProfile(); g.refreshBackgroundWorld(); });
      E['arena-select'].addEventListener('change', () => { g.settings.arena = E['arena-select'].value; g.saveProfile(); g.refreshBackgroundWorld(); });
      E['ranked-toggle'].checked = !!g.profile.ranked;
      E['ranked-toggle'].addEventListener('change', () => {
        g.profile.ranked = E['ranked-toggle'].checked; g.saveProfile(); this.renderModeInfo(); g.refreshBackgroundWorld();
      });
      E['lang-switch'].addEventListener('click', e => {
        const b = e.target.closest('button[data-lang]');
        if (!b) return;
        MG.Audio.play('click');
        g.setLanguage(b.dataset.lang);
      });

      E.nick.value = g.profile.name || '';
      E.nick.addEventListener('input', () => E['nick-warn'].classList.add('hidden'));
      E['play-btn'].addEventListener('click', () => g.play());
      E['skin-btn'].addEventListener('click', () => this.openModal('skins'));
      E['spectate-btn'].addEventListener('click', () => g.startSpectate());
      E['spectate-exit'].addEventListener('click', () => g.toMenu());
      E['again-btn'].addEventListener('click', () => g.play());
      E['watch-btn'].addEventListener('click', () => g.startSpectate(true));
      E['menu-btn'].addEventListener('click', () => g.toMenu());
      E['resume-btn'].addEventListener('click', () => g.resume());
      E['quit-btn'].addEventListener('click', () => g.quitMatch());
      E['pause-btn'].addEventListener('click', () => g.pause());
      E['power-slot'].addEventListener('click', () => g.usePower());

      document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => { MG.Audio.play('click'); this.openModal(b.dataset.open); }));
      E.modal.addEventListener('click', e => { if (e.target === E.modal || e.target.closest('.modal-close')) this.closeModal(); });

      E.quickchat.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        g.quickChat(parseInt(b.dataset.i, 10));
        E.quickchat.classList.add('hidden');
      });

      if (g.input.isTouch) document.body.classList.add('touch');
      this.applySettings();
      this.applyLanguage();
    },

    // Dil değişince tüm statik metinleri ve listeleri yeniden kur
    applyLanguage() {
      const E = this.els, g = this.game;
      MG.I18N.apply(document);
      E['lang-switch'].querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.lang === MG.I18N.lang));
      E.modes.innerHTML = MG.MODE_ORDER.map(id => {
        const m = MG.MODES[id];
        return '<button class="mode-card" data-mode="' + id + '"><span class="mi">' + m.icon + '</span><span class="mn">' + esc(m.name) + '</span><span class="mt">' + esc(m.tag) + '</span></button>';
      }).join('');
      E.difficulty.innerHTML = Object.keys(MG.DIFFICULTIES).map(k => '<option value="' + k + '">' + esc(MG.DIFFICULTIES[k].name) + '</option>').join('');
      E.difficulty.value = g.settings.difficulty;
      E['arena-select'].innerHTML = '<option value="random">' + esc(t('ui.randomArena')) + '</option>' + MG.RANDOM_ARENAS.map(k => '<option value="' + k + '">' + esc(MG.ARENAS[k].name) + '</option>').join('');
      E['arena-select'].value = g.settings.arena;
      E.quickchat.innerHTML = MG.QUICK_CHAT.map((q, i) => '<button data-i="' + i + '">' + q.key + ' ' + esc(q.text) + '</button>').join('');
      this.lastLbHtml = '';
      this.renderMenu();
      if (this.game.world) this.renderLiveInfo(this.game.world);
    },

    applySettings() {
      const s = this.game.settings;
      document.documentElement.style.setProperty('--ui-scale', s.uiScale || 1);
      this.els.minimap.classList.toggle('hidden', !s.showMinimap);
      const touch = s.touchControls === 'on' || (s.touchControls === 'auto' && this.game.input.isTouch);
      this.els['touch-ui'].classList.toggle('hidden', !touch);
    },

    /* ---------------- menu ---------------- */
    renderMenu() {
      this.renderProfileCard();
      this.renderMissions();
      this.renderModes();
      this.renderSkinButton();
    },

    renderSkinButton() {
      const g = this.game;
      const col = g.profile.color ? U.fromHex(g.profile.color) : U.makeColor(0, 229, 255);
      const c = g.renderer.skins.preview(g.profile.skin, col, 116);
      this.els['skin-btn'].innerHTML = '';
      this.els['skin-btn'].appendChild(c);
    },

    renderProfileCard() {
      const g = this.game, p = g.profile;
      const lv = MG.Progress.levelInfo();
      const rk = MG.Progress.rankInfo();
      const col = p.color ? U.fromHex(p.color) : U.makeColor(0, 229, 255);
      const el = this.els['profile-card'];
      const next = rk.next ? t('ui.nextRank', { rank: rk.next.name, lp: rk.next.min }) : t('ui.topRank');
      el.innerHTML =
        '<div class="pcard"><span id="pc-av"></span><div style="flex:1;min-width:0">' +
        '<div class="pname">' + esc(p.name || t('ui.noName')) + '</div>' +
        '<div class="plevel">' + t('ui.levelLine', { l: lv.level, xp: U.formatNum(lv.xp), need: U.formatNum(lv.need) }) + '</div>' +
        '<div class="bar"><i style="width:' + ((lv.xp / lv.need) * 100).toFixed(1) + '%"></i></div></div></div>' +
        '<div class="rank-badge" style="color:' + rk.rank.color + '"><span class="ri">' + rk.rank.icon + '</span><div style="flex:1">' +
        '<div class="rn">' + esc(rk.label) + '</div><div class="rl">' + rk.lp + ' LP · ' + esc(next) + '</div>' +
        '<div class="bar"><i style="width:' + (rk.prog * 100).toFixed(1) + '%;background:' + rk.rank.color + '"></i></div></div></div>';
      el.querySelector('#pc-av').appendChild(g.renderer.skins.preview(p.skin, col, 112));
    },

    renderMissions() {
      MG.Progress.ensureMissions();
      const p = this.game.profile;
      this.els.missions.innerHTML = p.missions.list.map(m => {
        const pr = MG.Progress.missionProgress(m);
        return '<div class="mission' + (m.done ? ' done' : '') + '"><div class="mt"><span>' + esc(MG.Progress.missionText(m)) + '</span><span class="mx">+' + m.xp + ' XP</span></div>' +
          '<div class="bar"><i style="width:' + (pr * 100).toFixed(0) + '%"></i></div><div class="mp">' + esc(MG.Progress.missionLabel(m)) + '</div></div>';
      }).join('');
      const now = new Date();
      const left = 24 * 3600 - (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds());
      this.els['mission-reset'].textContent = t('ui.missionReset', { h: Math.floor(left / 3600), m: Math.floor((left % 3600) / 60) });
    },

    renderModes() {
      const sel = this.game.selectedMode;
      this.els.modes.querySelectorAll('.mode-card').forEach(b => b.classList.toggle('active', b.dataset.mode === sel));
      const m = MG.MODES[sel];
      this.els['arena-wrap'].classList.toggle('hidden', m.arena !== 'random');
      this.renderModeInfo();
    },

    renderModeInfo() {
      const g = this.game;
      const m = MG.MODES[g.selectedMode];
      let h = '<b>' + m.icon + ' ' + esc(m.name) + ':</b> ' + esc(m.desc);
      if (g.profile.ranked) h += '<br>' + (m.ranked ? t('ui.modeRanked') : t('ui.modeNotRanked'));
      this.els['mode-info'].innerHTML = h;
    },

    renderLiveInfo(world) {
      if (!world) return;
      let alive = 0;
      for (const p of world.players) if (p.alive) alive++;
      let h = '🌐 <b>' + esc(world.arena.name) + '</b> · ' + esc(t('ui.players', { n: alive })) + ' · ' + esc(MG.MODES[world.modeId].name);
      if (world.mutators.length) h += '<br>' + world.mutators.map(m => '<span class="mut" title="' + esc(m.desc) + '">' + m.icon + ' ' + esc(m.name) + '</span>').join('');
      this.els['live-info'].innerHTML = h;
    },

    showMenu(v) { this.els.menu.classList.toggle('hidden', !v); if (v) { this.renderMenu(); this.els.nick.value = this.game.profile.name || ''; } },
    showHud(v) { this.els.hud.classList.toggle('hidden', !v); },
    showPause(v) { this.els.pause.classList.toggle('hidden', !v); },
    showDeathScreen(v) { this.els.death.classList.toggle('hidden', !v); },
    showSpectateBar(v, name) {
      this.els['spectate-bar'].classList.toggle('hidden', !v);
      if (name !== undefined) this.els['spectate-name'].textContent = t('ui.spectating', { name });
    },

    nickWarning(text) {
      const w = this.els['nick-warn'];
      w.textContent = text;
      w.classList.remove('hidden');
    },

    /* ---------------- death / results ---------------- */
    showDeath(info) {
      const E = this.els;
      E['death-title'].textContent = info.title;
      E['death-sub'].innerHTML = info.sub || '';
      E['death-stats'].innerHTML = info.stats.map(s => '<div class="stat"><div class="sv">' + esc(s[1]) + '</div><div class="sl">' + esc(s[0]) + '</div></div>').join('');
      const r = info.report;
      let h = '';
      if (r) {
        h += '<div class="rewards">' + r.breakdown.map(b => '<div class="rrow"><span>' + esc(b[0]) + '</span><b>+' + b[1] + '</b></div>').join('') +
          '<div class="rrow total"><span>' + esc(t('ui.totalXp')) + '</span><b>+' + r.xp + '</b></div></div>';
        const lv = MG.Progress.levelInfo();
        h += '<div class="bar" style="margin-top:10px"><i style="width:' + ((lv.xp / lv.need) * 100).toFixed(1) + '%"></i></div>' +
          '<div class="muted" style="font-size:12px;margin-top:4px">' + esc(t('ui.levelShort', { l: lv.level, xp: U.formatNum(lv.xp), need: U.formatNum(lv.need) })) + '</div>';
        if (r.rankAfter) {
          const up = r.lpDelta >= 0;
          h += '<div class="lp-change ' + (up ? 'up' : 'down') + '">' + r.rankAfter.rank.icon + ' ' + esc(r.rankAfter.label) + ' · ' + (up ? '+' : '') + r.lpDelta + ' LP</div>';
        }
      }
      E['death-rewards'].innerHTML = h;
      E['watch-btn'].classList.toggle('hidden', !info.canWatch);
      E['again-btn'].textContent = info.againText || t('ui.playAgain');
      this.showDeathScreen(true);
      setTimeout(() => { try { E['again-btn'].focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 50);
    },

    /* ---------------- notifications ---------------- */
    toast(icon, title, sub) {
      const d = document.createElement('div');
      d.className = 'toast';
      d.innerHTML = '<span class="ti">' + icon + '</span><div>' + esc(title) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>';
      this.els.toasts.appendChild(d);
      setTimeout(() => d.remove(), 3700);
      while (this.els.toasts.children.length > 4) this.els.toasts.firstChild.remove();
    },

    announce(text, small) {
      const d = document.createElement('div');
      d.className = 'ann' + (small ? ' sm' : '');
      d.textContent = text;
      const a = this.els.announce;
      a.appendChild(d);
      setTimeout(() => d.remove(), 2300);
      while (a.children.length > 3) a.firstChild.remove();
    },

    killfeed(html, cls) {
      const d = document.createElement('div');
      d.className = 'kf ' + (cls || '');
      d.innerHTML = html;
      const k = this.els.killfeed;
      k.appendChild(d);
      setTimeout(() => d.remove(), 5000);
      while (k.children.length > 4) k.firstChild.remove();
    },

    addChat(m) {
      const d = document.createElement('div');
      d.className = 'cm' + (m.system ? ' sys' : '');
      if (m.system) d.textContent = m.text;
      else d.innerHTML = '<b style="color:' + m.color + '">' + esc(m.name) + ':</b> ' + esc(m.text);
      const log = this.els['chat-log'];
      log.appendChild(d);
      setTimeout(() => d.classList.add('old'), 12000);
      while (log.children.length > 9) log.firstChild.remove();
    },

    clearHud() {
      this.els['chat-log'].innerHTML = '';
      this.els.killfeed.innerHTML = '';
      this.els.announce.innerHTML = '';
      this.els['event-banner'].classList.add('hidden');
      this.els['event-banner'].dataset.id = '';
      this.lastLbHtml = '';
    },

    toggleQuickChat() { this.els.quickchat.classList.toggle('hidden'); },

    /* ---------------- in-game update ---------------- */
    update(dt, world, me, cam, fps) {
      if (!world) return;
      const E = this.els;
      const g = this.game;
      if (me) {
        const score = Math.floor(me.alive ? me.totalMass : 0);
        if (score !== this.lastScore) { E['score-val'].textContent = U.formatNum(score); this.lastScore = score; }
      }
      this.lbTimer -= dt;
      if (this.lbTimer <= 0) {
        this.lbTimer = 0.25;
        this.renderLeaderboard(world, me);
        this.renderEffects(world, me);
        this.renderModeBar(world, me);
        this.renderEvent(world);
        if (me) {
          const s = me.stats;
          const time = me.alive ? world.time - s.spawnTime : 0;
          let h = '🍬 ' + U.formatNum(s.food) + ' · 🎯 ' + s.kills + ' · ⏱ ' + U.formatTime(time);
          if (g.settings.showFps) h += ' · ' + Math.round(fps) + ' FPS';
          E['hud-stats'].textContent = h;
        }
      }
      this.miniTimer -= dt;
      if (this.miniTimer <= 0 && g.settings.showMinimap) {
        this.miniTimer = 0.1;
        g.renderer.drawMinimap(E.minimap, world, me, cam);
      }
    },

    renderLeaderboard(world, me) {
      const E = this.els;
      const lb = world.leaderboard;
      const crown = world.mode.crown;
      const teams = world.mode.teams;
      E['lb-title'].textContent = crown ? t('ui.crownPoints') : t('ui.leaderboard');
      let h = '';
      const n = Math.min(teams ? 5 : 10, lb.length);
      let meShown = false;
      const unnamed = t('ui.unnamed');
      for (let i = 0; i < n; i++) {
        const e = lb[i];
        const p = e.player;
        const isMe = p === me;
        if (isMe) meShown = true;
        const val = crown ? Math.floor(e.points) + ' 👑' : U.formatNum(e.mass);
        const dot = teams ? '<span style="color:' + U.rgba(MG.TEAMS[p.team].color, 1) + '">● </span>' : '';
        h += '<li class="' + (isMe ? 'me' : '') + (p.isBoss ? ' boss' : '') + '"><span class="n">' + (i + 1) + '. ' + dot + esc(p.name || unnamed) + '</span><span class="v">' + val + '</span></li>';
      }
      if (me && me.alive && !meShown && me.rank > 0) {
        const val = crown ? Math.floor(me.crownPoints) + ' 👑' : U.formatNum(me.totalMass);
        h += '<li class="gap">···</li><li class="me"><span class="n">' + me.rank + '. ' + esc(me.name || unnamed) + '</span><span class="v">' + val + '</span></li>';
      }
      if (h !== this.lastLbHtml) { E['lb-list'].innerHTML = h; this.lastLbHtml = h; }
      E['team-pie'].classList.toggle('hidden', !teams);
      if (teams) this.drawTeamPie(world);
      document.documentElement.style.setProperty('--lb-h', (E.leaderboard.offsetHeight + 8) + 'px');
    },

    drawTeamPie(world) {
      const c = this.els['team-pie'];
      const g = c.getContext('2d');
      const tm = world.teamMass;
      const total = tm[1] + tm[2] + tm[3] || 1;
      g.clearRect(0, 0, 120, 120);
      let a = -Math.PI / 2;
      for (let i = 1; i <= 3; i++) {
        const s = (tm[i] / total) * U.TAU;
        g.beginPath(); g.moveTo(60, 60); g.arc(60, 60, 56, a, a + s); g.closePath();
        g.fillStyle = U.rgba(MG.TEAMS[i].color, 0.95); g.fill();
        a += s;
      }
      g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.4)';
      g.beginPath(); g.arc(60, 60, 56, 0, U.TAU); g.stroke();
    },

    renderEffects(world, me) {
      const E = this.els;
      let h = '';
      if (me && me.alive) {
        for (const k in me.effects) {
          const def = k === 'frozen' ? { icon: '🧊', name: t('ui.frozen'), duration: 3.5 } : MG.POWERUPS[k];
          if (!def) continue;
          const pct = U.clamp(me.effects[k] / (def.duration || 1), 0, 1) * 100;
          h += '<div class="eff">' + def.icon + ' ' + esc(def.name) + '<div class="bar"><i style="width:' + pct.toFixed(0) + '%"></i></div></div>';
        }
        const allies = [];
        for (const p of world.players) if (p.alive && me.isAlly(p, world.time)) allies.push(p.name);
        if (allies.length) h += '<div class="eff">🤝 ' + esc(allies.slice(0, 2).join(', ')) + '</div>';
      }
      E.effects.innerHTML = h;
      const pw = me && me.alive ? me.power : null;
      const slot = E['power-slot'];
      slot.classList.toggle('ready', !!pw);
      slot.classList.toggle('empty', !pw);
      E['power-icon'].textContent = pw ? MG.POWERUPS[pw].icon : '·';
      E['power-name'].textContent = pw ? MG.POWERUPS[pw].name : t('ui.noPower');
      slot.style.display = world.targets.powerups > 0 || pw ? '' : 'none';
    },

    renderModeBar(world, me) {
      const E = this.els;
      const info = world.modeCtl.hud();
      if (!info) { E['mode-bar'].classList.add('hidden'); return; }
      E['mode-bar'].classList.remove('hidden');
      let h;
      if (info.type === 'royale') {
        h = esc(t('ui.royaleLeft', { n: info.alive })) + '<div class="sub">' + esc(info.label) + '</div>';
        E['mode-bar'].classList.toggle('danger', info.danger || (me && me.alive && this.outsideZone(world, me)));
      } else {
        const holder = info.holder ? info.holder.name || t('ui.unnamed') : t('ui.crownNobody');
        h = esc(t('ui.crownBar', { name: holder, t: U.formatTime(info.remaining) })) + (me ? '<div class="sub">' + esc(t('ui.yourPoints', { n: Math.floor(me.crownPoints) })) + '</div>' : '');
        E['mode-bar'].classList.toggle('danger', info.remaining < 30);
      }
      E['mode-bar'].innerHTML = h;
    },

    outsideZone(world, me) {
      const z = world.modeCtl.zone;
      return z && U.dist(me.cx, me.cy, z.x, z.y) > z.r;
    },

    renderEvent(world) {
      const E = this.els;
      const ev = world.events.active[world.events.active.length - 1];
      const b = E['event-banner'];
      if (!ev) { b.classList.add('hidden'); b.dataset.id = ''; return; }
      const key = ev.id + ev.duration + MG.I18N.lang;
      const pct = U.clamp(ev.remaining / ev.duration, 0, 1) * 100;
      if (b.dataset.id !== key) {
        b.dataset.id = key;
        b.innerHTML = '<div class="et">' + ev.def.icon + ' ' + esc(ev.def.name) + '</div><div class="ed">' + esc(ev.def.desc) + '</div><div class="eb"><i></i></div>';
        b.classList.remove('hidden');
        b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
      }
      const bar = b.querySelector('.eb i');
      if (bar) bar.style.width = pct.toFixed(1) + '%';
    },

    /* ---------------- modals ---------------- */
    openModal(type) {
      this.modalType = type;
      const body = this.els['modal-body'];
      body.innerHTML = '';
      switch (type) {
        case 'skins': this.buildSkins(body); break;
        case 'settings': this.buildSettings(body); break;
        case 'profile': this.buildProfile(body); break;
        case 'achievements': this.buildAchievements(body); break;
        case 'help': this.buildHelp(body); break;
      }
      this.els.modal.classList.remove('hidden');
    },

    closeModal() {
      this.els.modal.classList.add('hidden');
      this.modalType = null;
      this.renderMenu();
    },

    isModalOpen() { return !this.els.modal.classList.contains('hidden'); },

    buildSkins(body) {
      const g = this.game, p = g.profile;
      const col = p.color ? U.fromHex(p.color) : U.makeColor(0, 229, 255);
      body.innerHTML = '<h2>' + esc(t('ui.skinsTitle')) + '</h2><h3>' + esc(t('ui.color')) + '</h3><div class="color-row" id="sw-row"></div><h3>' + esc(t('ui.skins')) + '</h3><div class="skin-grid" id="skin-grid"></div>';
      const row = body.querySelector('#sw-row');
      const rnd = document.createElement('button');
      rnd.className = 'swatch' + (!p.color ? ' sel' : '');
      rnd.style.background = 'conic-gradient(#f33,#ff3,#3f3,#3ff,#33f,#f3f,#f33)';
      rnd.title = t('ui.randomColor');
      rnd.addEventListener('click', () => { p.color = null; g.saveProfile(); this.buildSkins(body); });
      row.appendChild(rnd);
      for (const hex of COLOR_SWATCHES) {
        const b = document.createElement('button');
        b.className = 'swatch' + (p.color === hex ? ' sel' : '');
        b.style.background = hex;
        b.addEventListener('click', () => { p.color = hex; g.saveProfile(); this.buildSkins(body); });
        row.appendChild(b);
      }
      const grid = body.querySelector('#skin-grid');
      for (const s of MG.SKINS) {
        const unlocked = MG.Progress.isSkinUnlocked(s);
        const b = document.createElement('button');
        b.className = 'skin-item' + (p.skin === s.id ? ' sel' : '') + (unlocked ? '' : ' locked');
        b.appendChild(g.renderer.skins.preview(s.id, col, 128));
        const n = document.createElement('div');
        n.innerHTML = esc(s.name) + (unlocked ? '' : '<div class="req">' + esc(MG.Progress.unlockText(s)) + '</div>');
        b.appendChild(n);
        b.addEventListener('click', () => {
          if (!unlocked) { this.toast('🔒', t('ui.lockedSkin'), t('ui.lockedNeed', { req: MG.Progress.unlockText(s) })); return; }
          MG.Audio.play('click');
          p.skin = s.id; g.saveProfile(); this.buildSkins(body);
        });
        grid.appendChild(b);
      }
    },

    buildSettings(body) {
      const g = this.game, s = g.settings;
      const tg = key => '<label class="toggle"><input type="checkbox" data-k="' + key + '"' + (s[key] ? ' checked' : '') + '><span class="slider"></span><span>' + esc(t('ui.s_' + key)) + '</span></label>';
      const sel = (key, label, opts) => '<div class="set-row">' + esc(label) + '<select data-k="' + key + '">' +
        opts.map(o => '<option value="' + o[0] + '"' + (String(s[key]) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select></div>';
      body.innerHTML = '<h2>' + esc(t('ui.settingsTitle')) + '</h2>' +
        '<div class="set-grid">' + sel('lang', t('ui.s_lang'), MG.I18N.LANGS) + '</div>' +
        '<h3>' + esc(t('ui.visual')) + '</h3><div class="set-grid">' +
        tg('showNames') + tg('showMass') + tg('showSkins') + tg('showGrid') + tg('showMinimap') + tg('darkClassic') +
        tg('jelly') + tg('particles') + tg('reducedMotion') + tg('showFps') +
        sel('quality', t('ui.s_quality'), [['auto', t('ui.q_auto')], ['high', t('ui.q_high')], ['low', t('ui.q_low')]]) +
        '<div class="set-row">' + esc(t('ui.s_uiScale')) + ' <input type="range" min="0.8" max="1.4" step="0.05" data-k="uiScale" value="' + s.uiScale + '"></div>' +
        '</div><h3>' + esc(t('ui.gameplay')) + '</h3><div class="set-grid">' +
        tg('events') + tg('powerups') +
        sel('botCount', t('ui.s_botCount'), [[0, t('ui.bc_default')], [15, t('ui.bc_light')], [25, '25'], [35, '35'], [50, '50'], [65, t('ui.bc_crowded')]]) +
        sel('touchControls', t('ui.s_touch'), [['auto', t('ui.t_auto')], ['on', t('ui.t_on')], ['off', t('ui.t_off')]]) +
        '</div><h3>' + esc(t('ui.soundH')) + '</h3><div class="set-grid">' + tg('sound') +
        '<div class="set-row">' + esc(t('ui.s_volume')) + ' <input type="range" min="0" max="1" step="0.05" data-k="volume" value="' + s.volume + '"></div></div>' +
        '<h3>' + esc(t('ui.data')) + '</h3><button class="btn danger small" id="reset-profile">' + esc(t('ui.resetProfile')) + '</button> <span class="muted" style="font-size:12px">' + esc(t('ui.dataNote')) + '</span>';
      body.querySelectorAll('[data-k]').forEach(el => {
        el.addEventListener('change', () => {
          const k = el.dataset.k;
          let v;
          if (el.type === 'checkbox') v = el.checked;
          else if (el.type === 'range') v = parseFloat(el.value);
          else if (k === 'botCount') v = parseInt(el.value, 10);
          else v = el.value;
          if (k === 'lang') { g.setLanguage(v); this.buildSettings(body); return; }
          s[k] = v;
          g.onSettingsChanged(k);
        });
        if (el.type === 'range') el.addEventListener('input', () => { s[el.dataset.k] = parseFloat(el.value); g.onSettingsChanged(el.dataset.k); });
      });
      body.querySelector('#reset-profile').addEventListener('click', () => {
        if (window.confirm(t('ui.resetConfirm'))) g.resetProfile();
      });
    },

    buildProfile(body) {
      const g = this.game, p = g.profile, st = p.stats;
      const rk = MG.Progress.rankInfo();
      const kv = (v, l) => '<div><b>' + v + '</b><span>' + esc(l) + '</span></div>';
      let h = '<h2>' + esc(t('ui.profileTitle')) + '</h2>';
      h += '<div class="kv">' +
        kv(p.level, t('ui.k_level')) + kv(rk.rank.icon + ' ' + esc(rk.label), t('ui.k_league', { lp: p.lp })) + kv(U.formatNum(st.games), t('ui.k_games')) +
        kv(U.formatNum(st.highestMass), t('ui.k_highest')) + kv(U.formatNum(st.kills), t('ui.k_kills')) + kv(U.formatNum(st.cellsEaten), t('ui.k_cells')) +
        kv(U.formatNum(st.foodEaten), t('ui.k_food')) + kv(st.top1, t('ui.k_top1')) + kv(st.brWins, t('ui.k_br')) + kv(st.crownWins, t('ui.k_crown')) +
        kv(U.formatTime(st.longestLife), t('ui.k_longest')) + kv(esc(t('ui.minutesShort', { n: Math.round(st.timePlayed / 60) })), t('ui.k_total')) + '</div>';
      h += '<h3>' + esc(t('ui.ladder')) + '</h3><div class="ladder">' + MG.RANKS.map((r, i) =>
        '<span class="' + (i === rk.idx ? 'cur' : '') + '" style="color:' + r.color + '">' + r.icon + ' ' + esc(r.name) + ' <small>' + r.min + '</small></span>').join('') + '</div>';
      h += '<h3>' + esc(t('ui.recent')) + '</h3>';
      if (!p.history.length) h += '<p class="muted">' + esc(t('ui.noMatches')) + '</p>';
      else {
        h += '<table class="hist"><tr><th>' + [t('ui.h_mode'), t('ui.h_mass'), t('ui.h_rank'), t('ui.h_kills'), t('ui.h_time'), t('ui.h_lp')].map(esc).join('</th><th>') + '</th></tr>' + p.history.map(m =>
          '<tr><td>' + (MG.MODES[m.mode] ? MG.MODES[m.mode].icon + ' ' + esc(MG.MODES[m.mode].name) : esc(m.mode)) + '</td><td>' + U.formatNum(m.mass) + '</td><td>#' + (m.rank >= 999 || !m.rank ? '-' : m.rank) +
          '</td><td>' + m.kills + '</td><td>' + U.formatTime(m.time) + '</td><td>' + (m.ranked ? (m.lp >= 0 ? '+' : '') + m.lp : '—') + '</td></tr>').join('') + '</table>';
      }
      body.innerHTML = h;
    },

    buildAchievements(body) {
      const p = this.game.profile;
      const got = MG.Progress.ACHIEVEMENTS.filter(a => p.achievements[a.id]).length;
      body.innerHTML = '<h2>' + esc(t('ui.achTitle')) + ' <span class="muted" style="font-size:14px">' + got + ' / ' + MG.Progress.ACHIEVEMENTS.length + '</span></h2><div class="ach-grid">' +
        MG.Progress.ACHIEVEMENTS.map(a => '<div class="ach' + (p.achievements[a.id] ? ' got' : '') + '"><span class="ai">' + a.icon + '</span><div><div class="an">' + esc(a.name) + '</div><div class="ad">' + esc(a.desc) + '</div></div></div>').join('') + '</div>';
    },

    buildHelp(body) {
      const items = t('ui.helpItems');
      body.innerHTML = '<h2>' + esc(t('ui.helpTitle')) + '</h2><div class="help-grid">' + items.map(i => '<div><b>' + esc(i[0]) + '</b>' + esc(i[1]) + '</div>').join('') + '</div>';
    }
  };

  MG.UI = UI;
})(window.MG = window.MG || {});
