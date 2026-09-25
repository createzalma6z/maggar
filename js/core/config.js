/* MAGGAR.io — oyun ayarları, modlar, arenalar, güçler, olaylar */
(function (MG) {
  'use strict';

  // Orijinal oyuna sadık temel fizik sabitleri
  MG.CFG = {
    START_MASS: 10,
    MIN_SPLIT_MASS: 35,
    MIN_EJECT_MASS: 35,
    EJECT_MASS: 13,
    EJECT_LOSS: 16,
    EJECT_DIST: 620,
    EJECT_COOLDOWN: 0.085,
    MAX_CELLS: 16,
    MAX_CELL_MASS: 22500,
    EAT_RATIO: 1.25,
    EAT_OVERLAP: 0.35,
    VIRUS_MASS: 100,
    VIRUS_POP_RATIO: 1.33,
    VIRUS_FEEDS: 7,
    VIRUS_MAX_MASS: 200,
    VIRUS_SHOT_DIST: 950,
    SPLIT_DIST: 740,
    BOOST_DECAY: 5.2,
    SPEED_BASE: 2150,
    SPEED_EXP: -0.439,
    DECAY_RATE: 0.002,
    DECAY_MIN_MASS: 40,
    MERGE_MASS_FACTOR: 0.02,
    NO_COLLIDE_TIME: 0.45,
    PELLET_BUCKET: 200,
    DENSITY_BUCKET: 500,
    CELL_BUCKET: 400,
    VIEW_W: 1920,
    VIEW_H: 1080,
    POWERUP_R: 34
  };

  MG.MODES = {
    classic: {
      id: 'classic', icon: '🟢', worldSize: 9000, pellets: 2600, viruses: 30, bots: 42, respawn: true, startMass: 10,
      mergeBase: 30, powerups: 0, events: false, biomes: false, mutators: false,
      teams: 0, ranked: true, arena: 'classic', persistent: true
    },
    arena: {
      id: 'arena', icon: '🌀', worldSize: 10000, pellets: 3200, viruses: 32, bots: 45, respawn: true, startMass: 10,
      mergeBase: 20, powerups: 10, events: true, biomes: true, mutators: true,
      teams: 0, ranked: true, arena: 'random', persistent: true
    },
    teams: {
      id: 'teams', icon: '🛡️', worldSize: 9000, pellets: 2800, viruses: 30, bots: 44, respawn: true, startMass: 10,
      mergeBase: 25, powerups: 6, events: true, biomes: false, mutators: false,
      teams: 3, ranked: false, arena: 'neon', persistent: true
    },
    royale: {
      id: 'royale', icon: '🔥', worldSize: 7000, pellets: 2400, viruses: 24, bots: 29, respawn: false, startMass: 40,
      mergeBase: 18, powerups: 8, events: false, biomes: true, mutators: false,
      teams: 0, ranked: true, arena: 'random', persistent: false, zone: true
    },
    experimental: {
      id: 'experimental', icon: '🧪', worldSize: 9000, pellets: 2200, viruses: 28, bots: 40, respawn: true, startMass: 10,
      mergeBase: 22, powerups: 0, events: false, biomes: false, mutators: false,
      teams: 0, ranked: false, arena: 'cyber', persistent: true, mothers: 10, movingViruses: true
    },
    crown: {
      id: 'crown', icon: '👑', worldSize: 8000, pellets: 2600, viruses: 26, bots: 36, respawn: true, startMass: 10,
      mergeBase: 20, powerups: 6, events: true, biomes: false, mutators: false,
      teams: 0, ranked: true, arena: 'random', persistent: false, crown: true, duration: 300
    }
  };
  MG.MODE_ORDER = ['classic', 'arena', 'teams', 'royale', 'experimental', 'crown'];

  MG.ARENAS = {
    classic: {
      id: 'classic', light: true, bg: '#f2fbff', grid: 'rgba(0,0,0,0.13)',
      border: 'rgba(0,0,0,0.4)', pelletGlow: false, biomes: [], particles: null, accent: '#1e88e5'
    },
    classicDark: {
      id: 'classicDark', light: false, bg: '#111111', grid: 'rgba(255,255,255,0.12)',
      border: 'rgba(255,255,255,0.4)', pelletGlow: false, biomes: [], particles: null, accent: '#1e88e5'
    },
    neon: {
      id: 'neon', bg: '#06060f', grid: 'rgba(0,240,255,0.10)', border: '#00f0ff',
      pelletGlow: true, biomes: ['speed', 'nebula', 'fog', 'speed', 'wormhole'], particles: 'dust', accent: '#00f0ff'
    },
    ocean: {
      id: 'ocean', bg: '#031425', grid: 'rgba(70,170,255,0.08)', border: '#3fa9ff',
      pelletGlow: true, biomes: ['current', 'current', 'current', 'fog', 'nebula'], particles: 'bubbles', accent: '#3fa9ff'
    },
    glacier: {
      id: 'glacier', bg: '#0a1824', grid: 'rgba(190,235,255,0.10)', border: '#bdf2ff',
      pelletGlow: true, biomes: ['ice', 'ice', 'ice', 'nebula', 'current'], particles: 'snow', accent: '#9be7ff'
    },
    volcano: {
      id: 'volcano', bg: '#120505', grid: 'rgba(255,100,40,0.09)', border: '#ff6a2a',
      pelletGlow: true, biomes: ['lava', 'lava', 'vent', 'vent', 'nebula'], particles: 'embers', accent: '#ff6a2a'
    },
    cosmos: {
      id: 'cosmos', bg: '#030208', grid: 'rgba(170,130,255,0.07)', border: '#b28cff',
      pelletGlow: true, biomes: ['gravity', 'wormhole', 'nebula', 'fog'], particles: 'stars', accent: '#b28cff'
    },
    cyber: {
      id: 'cyber', bg: '#0c0316', grid: 'rgba(255,40,200,0.09)', border: '#ff3fd0',
      pelletGlow: true, biomes: ['speed', 'speed', 'fog', 'nebula', 'wormhole'], particles: 'data', accent: '#ff3fd0'
    }
  };
  MG.RANDOM_ARENAS = ['neon', 'ocean', 'glacier', 'volcano', 'cosmos', 'cyber'];

  MG.BIOMES = {
    ice: { icon: '🧊', color: [150, 225, 255], radius: [800, 1150] },
    current: { icon: '🌊', color: [60, 150, 255], radius: [700, 1050], strength: 170 },
    speed: { icon: '💨', color: [0, 255, 170], radius: [450, 700], speedMul: 1.45 },
    lava: { icon: '🌋', color: [255, 80, 20], radius: [600, 900], decayMul: 6, pelletMul: 2 },
    fog: { icon: '🌫️', color: [150, 150, 190], radius: [800, 1150] },
    nebula: { icon: '✨', color: [255, 200, 60], radius: [650, 950], spawnWeight: 5 },
    gravity: { icon: '🕳️', color: [130, 70, 255], radius: [900, 1250], core: 150, strength: 240, drain: 0.035 },
    wormhole: { icon: '🌀', color: [0, 255, 255], radius: [130, 130] },
    vent: { icon: '🔥', color: [255, 130, 0], radius: [380, 460] }
  };

  MG.POWERUPS = {
    shield: { id: 'shield', icon: '🛡️', color: [80, 200, 255], duration: 6 },
    speed: { id: 'speed', icon: '⚡', color: [255, 230, 0], duration: 6 },
    magnet: { id: 'magnet', icon: '🧲', color: [255, 70, 90], duration: 8 },
    ghost: { id: 'ghost', icon: '👻', color: [200, 200, 255], duration: 7 },
    freeze: { id: 'freeze', icon: '❄️', color: [160, 240, 255], duration: 0 },
    rocket: { id: 'rocket', icon: '🚀', color: [255, 140, 40], duration: 10 },
    mass: { id: 'mass', icon: '➕', color: [120, 255, 120], duration: 0, instant: true }
  };
  MG.POWERUP_WEIGHTS = [['shield', 3], ['speed', 3], ['magnet', 2.5], ['ghost', 2], ['freeze', 2], ['rocket', 2], ['mass', 2.5]];

  MG.EVENTS = {
    food_rain: { icon: '🍬', duration: 14, weight: 3 },
    golden: { icon: '✨', duration: 20, weight: 2.5 },
    virus_storm: { icon: '🦠', duration: 25, weight: 2 },
    wind: { icon: '💨', duration: 18, weight: 2.5 },
    blackout: { icon: '🌑', duration: 18, weight: 2 },
    meteor: { icon: '☄️', duration: 16, weight: 2 },
    blackhole: { icon: '🕳️', duration: 30, weight: 1.5 },
    frenzy: { icon: '🔥', duration: 22, weight: 2 },
    titan: { icon: '👾', duration: 90, weight: 1.2 },
    power_storm: { icon: '⚡', duration: 20, weight: 1.8 }
  };

  MG.MUTATORS = [
    { id: 'feast', icon: '🍬', mod: { pellets: 1.8 } },
    { id: 'quickmerge', icon: '🧲', mod: { merge: 0.5 } },
    { id: 'hyper', icon: '💨', mod: { speed: 1.2 } },
    { id: 'rocketsplit', icon: '🚀', mod: { split: 1.4 } },
    { id: 'virusland', icon: '🦠', mod: { viruses: 1.7 } },
    { id: 'powersurge', icon: '⚡', mod: { powerups: 2 } },
    { id: 'chaos', icon: '🌪️', mod: { events: 0.55 } },
    { id: 'eternal', icon: '💎', mod: { decay: 0 } },
    { id: 'headstart', icon: '💪', mod: { startMass: 35 } },
    { id: 'giants', icon: '🗿', mod: { botMass: 2.5 } }
  ];

  MG.SKINS = [
    { id: 'none', type: 'none' },
    { id: 'smile', emoji: '😎' },
    { id: 'cat', emoji: '🐱' },
    { id: 'dog', emoji: '🐶' },
    { id: 'fox', emoji: '🦊' },
    { id: 'panda', emoji: '🐼' },
    { id: 'frog', emoji: '🐸' },
    { id: 'pizza', emoji: '🍕' },
    { id: 'ball', emoji: '⚽' },
    { id: 'bee', emoji: '🐝' },
    { id: 'star', emoji: '⭐', unlock: { level: 2 } },
    { id: 'rings', pattern: 'rings', unlock: { level: 2 } },
    { id: 'earth', emoji: '🌍', unlock: { level: 3 } },
    { id: 'alien', emoji: '👽', unlock: { level: 3 } },
    { id: 'checker', pattern: 'checker', unlock: { level: 4 } },
    { id: 'moon', emoji: '🌙', unlock: { level: 4 } },
    { id: 'robot', emoji: '🤖', unlock: { level: 5 } },
    { id: 'penguin', emoji: '🐧', unlock: { level: 5 } },
    { id: 'zebra', pattern: 'stripes', unlock: { level: 6 } },
    { id: 'galaxy', pattern: 'galaxy', unlock: { level: 7 } },
    { id: 'octopus', emoji: '🐙', unlock: { level: 7 } },
    { id: 'unicorn', emoji: '🦄', unlock: { level: 8 } },
    { id: 'spiral', pattern: 'spiral', unlock: { level: 9 } },
    { id: 'bolt', emoji: '⚡', unlock: { level: 10 } },
    { id: 'rainbow', pattern: 'rainbow', unlock: { level: 11 } },
    { id: 'hex', pattern: 'hex', unlock: { level: 12 } },
    { id: 'dragon', emoji: '🐉', unlock: { level: 13 } },
    { id: 'cybergrid', pattern: 'grid', unlock: { level: 14 } },
    { id: 'shark', emoji: '🦈', unlock: { level: 15 } },
    { id: 'melon', pattern: 'melon', unlock: { level: 16 } },
    { id: 'rocket', emoji: '🚀', unlock: { level: 18 } },
    { id: 'planet', pattern: 'planet', unlock: { level: 20 } },
    { id: 'eye', pattern: 'eye', unlock: { level: 25 } },
    { id: 'gem', emoji: '💎', unlock: { rank: 'diamond' } },
    { id: 'fire', emoji: '🔥', unlock: { rank: 'gold' } },
    { id: 'crown', emoji: '👑', unlock: { ach: 'crown_win' } },
    { id: 'titan', emoji: '👾', unlock: { ach: 'titan_slayer' } },
    { id: 'trophy', emoji: '🏆', unlock: { ach: 'br_win' } }
  ];

  MG.RANKS = [
    { id: 'bronze', min: 0, color: '#d08a4a', icon: '🥉' },
    { id: 'silver', min: 300, color: '#c9d3dd', icon: '🥈' },
    { id: 'gold', min: 600, color: '#ffd23f', icon: '🥇' },
    { id: 'platinum', min: 900, color: '#4ee6d8', icon: '💠' },
    { id: 'diamond', min: 1200, color: '#6ab8ff', icon: '💎' },
    { id: 'champion', min: 1500, color: '#ff5fd2', icon: '🏆' },
    { id: 'legend', min: 1800, color: '#ff9f1a', icon: '🔥' }
  ];

  MG.DIFFICULTIES = {
    easy: { mul: 0.75, mix: { newbie: 45, casual: 30, farmer: 15, friendly: 10 } },
    normal: { mul: 1, mix: { newbie: 18, casual: 30, farmer: 14, friendly: 10, hunter: 16, tactician: 8, pro: 4 } },
    hard: { mul: 1.12, mix: { newbie: 5, casual: 18, farmer: 10, friendly: 5, hunter: 30, tactician: 18, pro: 14 } },
    insane: { mul: 1.25, mix: { casual: 8, hunter: 34, tactician: 26, pro: 32 } },
    adaptive: { mul: 1, mix: null }
  };

  MG.QUICK_CHAT = [
    { key: '1', intent: 'greet' },
    { key: '2', intent: 'team' },
    { key: '3', intent: 'help' },
    { key: '4', intent: 'thanks' },
    { key: '5', intent: 'gg' },
    { key: '6', intent: 'taunt' }
  ];

  MG.TEAMS = [
    null,
    { id: 1, color: [255, 60, 70] },
    { id: 2, color: [60, 230, 90] },
    { id: 3, color: [60, 130, 255] }
  ];
})(window.MG = window.MG || {});
