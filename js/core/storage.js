/* MAGGAR.io — profil ve ayarların yerel kaydı (localStorage, sunucu yok) */
(function (MG) {
  'use strict';

  const KEY = 'maggar.profile.v1';

  const DEFAULT_SETTINGS = {
    lang: 'en',
    showMass: true,
    showNames: true,
    showSkins: true,
    showGrid: true,
    showMinimap: true,
    darkClassic: false,
    jelly: true,
    particles: true,
    quality: 'auto',
    reducedMotion: false,
    sound: true,
    volume: 0.6,
    difficulty: 'adaptive',
    botCount: 0,
    arena: 'random',
    events: true,
    powerups: true,
    showFps: false,
    touchControls: 'auto',
    uiScale: 1
  };

  function defaultProfile() {
    return {
      v: 1,
      name: '',
      skin: 'none',
      color: null,
      xp: 0,
      level: 1,
      lp: 0,
      peakLp: 0,
      rankedGames: 0,
      ranked: false,
      lastMode: 'classic',
      tutorialDone: false,
      stats: {
        games: 0, timePlayed: 0, foodEaten: 0, cellsEaten: 0, kills: 0, highestMass: 0,
        top1: 0, brWins: 0, crownWins: 0, powerups: 0, events: 0, virusFeeds: 0,
        longestLife: 0, massEaten: 0, deaths: 0, titanKills: 0
      },
      achievements: {},
      missions: { date: '', list: [], modes: [] },
      history: [],
      settings: Object.assign({}, DEFAULT_SETTINGS)
    };
  }

  function merge(base, saved) {
    if (!saved || typeof saved !== 'object') return base;
    for (const k of Object.keys(base)) {
      if (!(k in saved)) continue;
      const bv = base[k], sv = saved[k];
      if (bv && typeof bv === 'object' && !Array.isArray(bv) && sv && typeof sv === 'object' && !Array.isArray(sv)) {
        base[k] = merge(bv, sv);
      } else if (typeof bv === typeof sv || bv === null) {
        base[k] = sv;
      }
    }
    // dinamik anahtarlı nesneler (başarımlar)
    if (saved.achievements && typeof saved.achievements === 'object') base.achievements = saved.achievements;
    return base;
  }

  let memoryCopy = null;

  MG.Storage = {
    DEFAULT_SETTINGS,
    load() {
      let saved = null;
      try {
        const raw = window.localStorage && window.localStorage.getItem(KEY);
        if (raw) saved = JSON.parse(raw);
      } catch (e) { saved = memoryCopy; }
      if (!saved && memoryCopy) saved = memoryCopy;
      return merge(defaultProfile(), saved);
    },
    save(profile) {
      memoryCopy = JSON.parse(JSON.stringify(profile));
      try { window.localStorage && window.localStorage.setItem(KEY, JSON.stringify(profile)); } catch (e) { /* gizli mod vb. */ }
    },
    reset() {
      memoryCopy = null;
      try { window.localStorage && window.localStorage.removeItem(KEY); } catch (e) { /* yok say */ }
      return defaultProfile();
    }
  };
})(window.MG = window.MG || {});
