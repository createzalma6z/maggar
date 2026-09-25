/* MAGGAR.io — oyun varlıkları: oyuncu, hücre, virüs, fırlatılan kütle, güç küresi */
(function (MG) {
  'use strict';
  const U = MG.U;

  let NEXT_ID = 1;
  const KIND = MG.KIND = { CELL: 1, VIRUS: 2, EJECT: 3, POWER: 4, MOTHER: 5 };

  // Orijinal oyundaki gibi canlı yiyecek renkleri
  MG.PELLET_COLORS = [
    [255, 64, 64], [255, 140, 0], [255, 214, 0], [170, 255, 0], [60, 255, 90], [0, 255, 170],
    [0, 230, 255], [0, 150, 255], [70, 90, 255], [150, 70, 255], [220, 60, 255], [255, 60, 190],
    [255, 100, 130], [120, 255, 200], [255, 180, 120], [180, 220, 255]
  ];
  MG.GOLD_COLOR = [255, 205, 40];
  MG.LAVA_COLOR = [255, 110, 30];

  function newStats() {
    return {
      food: 0, cellsEaten: 0, kills: 0, massEaten: 0, highestMass: 0, bestRank: 999,
      spawnTime: 0, deathTime: 0, topTime: 0, powerups: 0, virusFeeds: 0, virusShots: 0,
      events: 0, comboBest: 0, feedGiven: 0, titan: 0
    };
  }

  class Player {
    constructor(o) {
      o = o || {};
      this.id = NEXT_ID++;
      this.name = o.name || '';
      this.color = o.color || U.randomCellColor();
      this.skin = o.skin || 'none';
      this.isBot = !!o.isBot;
      this.isHuman = !!o.isHuman;
      this.team = o.team || 0;
      this.brain = null;
      this.cells = [];
      this.targetX = 0;
      this.targetY = 0;
      this.alive = false;
      this.wantSplit = 0;
      this.wantEject = 0;
      this.ejecting = false;
      this.ejectTimer = 0;
      this.wantPower = false;
      this.power = null;
      this.effects = {};
      this.totalMass = 0;
      this.cx = 0;
      this.cy = 0;
      this.sumR = 0;
      this.rank = 0;
      this.allies = new Map();
      this.lastEatenBy = null;
      this.lastEatenAt = -99;
      this.killedBy = null;
      this.crownPoints = 0;
      this.eliminated = false;
      this.placement = 0;
      this.isBoss = false;
      this.isRival = false;
      this.stats = newStats();
      this.comboTimes = [];
    }

    static newStats() { return newStats(); }

    isAlly(other, now) {
      const t = this.allies.get(other.id);
      return t !== undefined && t > now;
    }

    updateCenter() {
      let m = 0, x = 0, y = 0, sr = 0;
      for (const c of this.cells) {
        m += c.mass; x += c.x * c.mass; y += c.y * c.mass; sr += c.r;
      }
      this.totalMass = m;
      this.sumR = sr;
      if (m > 0) { this.cx = x / m; this.cy = y / m; }
    }

    biggest() {
      let b = null;
      for (const c of this.cells) if (!b || c.mass > b.mass) b = c;
      return b;
    }

    smallest() {
      let s = null;
      for (const c of this.cells) if (!s || c.mass < s.mass) s = c;
      return s;
    }
  }

  class Cell {
    constructor(owner, x, y, mass, now) {
      this.id = NEXT_ID++;
      this.kind = KIND.CELL;
      this.owner = owner;
      this.x = x;
      this.y = y;
      this.mass = mass;
      this.r = Math.sqrt(mass * 100);
      this.renderR = this.r;
      this.mvx = 0; this.mvy = 0;
      this.bvx = 0; this.bvy = 0;
      this.born = now;
      this.mergeAt = now;
      this.tpAt = 0;
      this.dead = false;
      this.biome = null;
      this.seed = Math.random() * 1000;
    }
    setMass(m) { this.mass = m; this.r = Math.sqrt(m * 100); }
  }

  class Eject {
    constructor(x, y, mass, owner, now, angle) {
      this.id = NEXT_ID++;
      this.kind = KIND.EJECT;
      this.x = x; this.y = y;
      this.mass = mass;
      this.r = Math.sqrt(mass * 100) * 0.95;
      this.owner = owner;
      this.color = owner ? owner.color : U.randomCellColor();
      this.born = now;
      this.angle = angle;
      this.bvx = 0; this.bvy = 0;
      this.dead = false;
    }
  }

  class Virus {
    constructor(x, y, mass) {
      this.id = NEXT_ID++;
      this.kind = KIND.VIRUS;
      this.x = x; this.y = y;
      this.mass = mass;
      this.r = Math.sqrt(mass * 100);
      this.renderR = this.r;
      this.feeds = 0;
      this.feedAngle = 0;
      this.bvx = 0; this.bvy = 0;
      this.shooter = null;
      this.shotAt = -99;
      this.temp = false;
      this.expireAt = 0;
      this.wander = Math.random() * U.TAU;
      this.dead = false;
      this.seed = Math.random() * 100;
    }
    setMass(m) { this.mass = m; this.r = Math.sqrt(m * 100); }
  }

  class MotherCell {
    constructor(x, y, mass) {
      this.id = NEXT_ID++;
      this.kind = KIND.MOTHER;
      this.x = x; this.y = y;
      this.mass = mass;
      this.r = Math.sqrt(mass * 100);
      this.timer = 0;
      this.dead = false;
      this.seed = Math.random() * 100;
    }
  }

  class PowerUp {
    constructor(x, y, type, now) {
      this.id = NEXT_ID++;
      this.kind = KIND.POWER;
      this.x = x; this.y = y;
      this.type = type;
      this.r = type === 'crown' ? 46 : MG.CFG.POWERUP_R;
      this.born = now;
      this.dead = false;
      this.seed = Math.random() * 10;
    }
  }

  MG.Player = Player;
  MG.Cell = Cell;
  MG.Eject = Eject;
  MG.Virus = Virus;
  MG.MotherCell = MotherCell;
  MG.PowerUp = PowerUp;
})(window.MG = window.MG || {});
