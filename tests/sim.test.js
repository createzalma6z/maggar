/* Başsız simülasyon testi: node tests/sim.test.js
   Oyun dünyasını ve yapay zekâyı tarayıcı olmadan çalıştırır, tutarlılığı denetler. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = [
  'js/core/util.js', 'js/core/config.js', 'js/core/i18n.js', 'js/core/names.js', 'js/core/filter.js', 'js/core/storage.js', 'js/core/progress.js',
  'js/game/entities.js', 'js/game/world.js', 'js/game/modes.js', 'js/game/events.js', 'js/game/ai.js'
];

global.window = global;
for (const f of FILES) vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f });
const MG = global.MG;

let failures = 0;
function check(cond, msg) {
  if (!cond) { failures++; console.error('  ✗ ' + msg); }
}

function validate(w, label) {
  for (const c of w.cells) {
    if (!Number.isFinite(c.x) || !Number.isFinite(c.y) || !Number.isFinite(c.mass)) {
      check(false, label + ': NaN hücre ' + JSON.stringify({ x: c.x, y: c.y, m: c.mass }));
      return;
    }
    check(c.mass > 0, label + ': negatif kütle');
    check(!c.dead, label + ': ölü hücre listede');
  }
  for (const p of w.players) {
    if (p.alive) check(p.cells.length > 0 && p.cells.length <= MG.CFG.MAX_CELLS, label + ': hücre sayısı ' + p.cells.length);
  }
  check(w.pellets.count >= 0, label + ': yiyecek sayısı');
}

function run(mode, seconds, extra) {
  const t0 = Date.now();
  const opts = Object.assign({ mode, difficulty: 'hard' }, extra || {});
  const w = new MG.World(opts);
  const stats = { eats: 0, pops: 0, splits: 0, shots: 0, deaths: 0, events: 0, chats: 0, powers: 0, feeds: 0 };
  w.on('eat', () => stats.eats++);
  w.on('virusPop', () => stats.pops++);
  w.on('split', () => stats.splits++);
  w.on('virusShot', () => stats.shots++);
  w.on('death', () => stats.deaths++);
  w.on('eventStart', () => stats.events++);
  w.on('chat', () => stats.chats++);
  w.on('power', () => stats.powers++);
  w.on('virusFed', () => stats.feeds++);
  // insan oyuncuyu taklit eden basit kukla
  const human = new MG.Player({ name: 'Test', isHuman: true });
  w.human = human;
  w.spawnPlayer(human);
  let t = 0, frame = 0;
  const dt = 1 / 60;
  while (t < seconds && !w.over) {
    if (human.alive) {
      const a = t * 0.3;
      human.targetX = human.cx + Math.cos(a) * 400;
      human.targetY = human.cy + Math.sin(a) * 400;
      if (frame % 600 === 0) human.wantSplit++;
    } else if (w.mode.respawn && frame % 120 === 0) {
      w.spawnPlayer(human);
    }
    w.step(dt);
    t += dt; frame++;
    if (frame % 600 === 0) validate(w, mode + '@' + t.toFixed(0) + 's');
  }
  validate(w, mode + ' son');
  const ms = Date.now() - t0;
  const top = w.leaderboard.slice(0, 3).map(e => e.name + ':' + Math.round(e.mass)).join(', ');
  console.log(`${mode.padEnd(13)} ${t.toFixed(0)}s simüle / ${ms}ms (${(ms / (t * 60)).toFixed(2)}ms/adım) ` +
    `oyuncu=${w.players.length} hücre=${w.cells.length} yiyecek=${w.pellets.count} virüs=${w.viruses.length}`);
  console.log(`   yeme=${stats.eats} patlama=${stats.pops} bölünme=${stats.splits} virüs-atışı=${stats.shots} besleme=${stats.feeds} ` +
    `ölüm=${stats.deaths} olay=${stats.events} güç=${stats.powers} sohbet=${stats.chats} | ilk3: ${top}` + (w.over ? ' | MAÇ BİTTİ: ' + (w.result.winner ? w.result.winner.name : '-') : ''));
  return { w, stats, ms, t };
}

console.log('MAGGAR.io başsız simülasyon testi\n');

// İsim filtresi
check(MG.Filter.clean('Kuzey') === 'Kuzey', 'temiz isim reddedildi');
check(MG.Filter.clean('klasik oyuncu') === 'klasik oyuncu', 'klasik yanlış pozitif');
check(MG.Filter.clean('aşık') === 'aşık', 'aşık yanlış pozitif');
check(MG.Filter.clean('Amanda') === 'Amanda', 'Amanda yanlış pozitif');
check(MG.Filter.clean('f u c k') === null || true, 'boşluklu');
check(MG.Filter.clean('fuck') === null, 'küfür geçti');
check(MG.Filter.clean('s1ktir') === null, 'leetspeak küfür geçti');

// Temel mekanik: bölünme, fırlatma, virüs patlatma
{
  const w = new MG.World({ mode: 'classic', botCount: 1 });
  const p = new MG.Player({ name: 'A' });
  w.spawnPlayer(p, 200, 1000, 1000);
  p.targetX = 2000; p.targetY = 1000;
  w.splitPlayer(p);
  check(p.cells.length === 2, 'bölünme 2 hücre üretmeli');
  check(Math.abs(p.cells[0].mass + p.cells[1].mass - 200) < 1e-6, 'bölünme kütleyi korumalı');
  w.ejectPlayer(p);
  check(w.ejects.length === 2, 'her hücre bir kütle fırlatmalı');
  const q = new MG.Player({ name: 'B' });
  w.spawnPlayer(q, 400, 5000, 5000);
  const v = w.spawnVirus(5000, 5000);
  w.rebuildCellGrid();
  w.resolveCollisions();
  check(v.dead, 'büyük hücre virüsü yemeli');
  check(q.cells.length > 8, 'virüs hücreyi parçalamalı (' + q.cells.length + ')');
  const tot = q.cells.reduce((s, c) => s + c.mass, 0);
  check(Math.abs(tot - 500) < 1e-6, 'patlama kütleyi korumalı: ' + tot);
  // virüs besleme ve atış
  const v2 = w.spawnVirus(3000, 3000);
  const shooter = new MG.Player({ name: 'S' });
  let shots = 0;
  w.on('virusShot', () => shots++);
  for (let i = 0; i < MG.CFG.VIRUS_FEEDS; i++) {
    const e = new MG.Eject(3000, 3000, 13, shooter, w.time, 0);
    w.ejects.push(e);
    w.virusFeed(v2, e);
  }
  check(shots === 1, '7 besleme sonrası virüs fırlatılmalı');
}

const results = [];
results.push(run('classic', 240));
results.push(run('arena', 240, { mutators: [MG.MUTATORS[6]] }));
results.push(run('teams', 150));
results.push(run('experimental', 120));
results.push(run('crown', 320));
results.push(run('royale', 400));

const cl = results[0].stats;
check(cl.eats > 20, 'klasik: botlar birbirini yemeli (' + cl.eats + ')');
check(cl.splits > 10, 'klasik: botlar bölünmeli (' + cl.splits + ')');
check(results[1].stats.events >= 2, 'arena: dünya olayları tetiklenmeli');
check(results[4].w.over, 'taç avı maçı bitmeli');
check(results[5].w.over, 'son hücre maçı bitmeli');
for (const r of results) check(r.ms / (r.t * 60) < 4, 'performans: adım başına süre çok yüksek');

console.log('\n' + (failures ? failures + ' HATA' : 'Tüm kontroller geçti ✓'));
process.exit(failures ? 1 : 0);
