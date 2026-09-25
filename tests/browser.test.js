/* Tarayıcı duman testi: NODE_PATH=$(npm root -g) node tests/browser.test.js [ekran-görüntüsü-klasörü]
   index.html dosyasını file:// ile açar (okulda çift tıklama senaryosu), hataları ve dış istekleri denetler. */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'tests', 'shots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  const external = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + '\n' + e.stack));
  page.on('console', m => { if (m.type() === 'error' && !/jsdelivr|ERR_TUNNEL|net::/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('request', r => {
    const u = r.url();
    if (!u.startsWith('file:') && !u.startsWith('data:') && !u.startsWith('https://cdn.jsdelivr.net/')) external.push(u);
  });

  // CDN adresini (jsDelivr/gh) yerel dosyalara yönlendir; böylece test yayından önce de çalışır
  const CDN = 'https://cdn.jsdelivr.net/gh/createzalma6z/maggar@main/';
  const serveLocal = async p => p.route(CDN + '**', r => r.fulfill({ path: path.join(ROOT, r.request().url().slice(CDN.length)) }));
  await serveLocal(page);
  const url = 'file://' + path.join(ROOT, 'index.html');
  await page.goto(url);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, '01-menu.png') });

  // Dil geçişi: Türkçe'ye geç, doğrula, İngilizce'ye dön
  await page.click('#lang-switch button[data-lang="tr"]');
  await page.waitForTimeout(300);
  const trPlay = await page.$eval('#play-btn', el => el.textContent.trim());
  if (trPlay !== 'OYNA') errors.push('Türkçe geçişi çalışmadı: ' + trPlay);
  await page.screenshot({ path: path.join(OUT, '01b-menu-tr.png') });
  await page.click('#lang-switch button[data-lang="en"]');
  await page.waitForTimeout(200);
  const enPlay = await page.$eval('#play-btn', el => el.textContent.trim());
  if (enPlay !== 'PLAY') errors.push('English switch failed: ' + enPlay);

  // Modallar
  for (const m of ['skins', 'settings', 'help', 'profile', 'achievements']) {
    await page.evaluate(t => MG.UI.openModal(t), m);
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, '02-modal-' + m + '.png') });
    await page.evaluate(() => MG.UI.closeModal());
  }

  // Uygunsuz isim reddi
  await page.fill('#nick', 'fuck');
  await page.click('#play-btn');
  const warn = await page.$eval('#nick-warn', el => !el.classList.contains('hidden'));
  if (!warn) errors.push('isim filtresi uyarısı görünmedi');

  // Oyna
  await page.fill('#nick', 'Deneme');
  await page.click('#play-btn');
  await page.waitForTimeout(500);
  for (let i = 0; i < 30; i++) {
    await page.mouse.move(683 + Math.cos(i / 4) * 300, 384 + Math.sin(i / 4) * 200);
    await page.waitForTimeout(100);
  }
  await page.keyboard.press('Digit2');
  await page.keyboard.press('Space');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, '03-play-classic.png') });

  // Oyuncuyu büyütüp tekrar görüntüle
  await page.evaluate(() => { const me = MG.game.me; if (me && me.alive) me.cells[0].setMass(1500); });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, '04-play-big.png') });

  // Duraklatma
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, '05-pause.png') });
  await page.keyboard.press('Escape');

  // Ölüm ekranı
  await page.evaluate(() => {
    const g = MG.game, w = g.world;
    for (const c of g.me.cells) c.dead = true;
    w.cleanup();
  });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(OUT, '06-death.png') });

  // Diğer modlar
  const modes = ['arena', 'teams', 'royale', 'experimental', 'crown'];
  for (const m of modes) {
    await page.evaluate(mode => { MG.game.toMenu(); MG.game.selectMode(mode); }, m);
    await page.waitForTimeout(300);
    await page.click('#play-btn');
    await page.evaluate(() => { const me = MG.game.me; if (me && me.alive) me.cells[0].setMass(400); });
    for (let i = 0; i < 20; i++) {
      await page.mouse.move(683 + Math.cos(i / 3) * 250, 384 + Math.sin(i / 3) * 180);
      await page.waitForTimeout(80);
    }
    if (m === 'arena') {
      await page.evaluate(() => {
        const w = MG.game.world;
        w.events.trigger('meteor');
        const me = MG.game.me;
        me.power = 'shield';
      });
      await page.keyboard.press('KeyF');
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: path.join(OUT, '07-mode-' + m + '.png') });
  }

  // Karanlık olayı ve kara delik görseli
  await page.evaluate(() => { MG.game.toMenu(); MG.game.selectMode('arena'); });
  await page.click('#play-btn');
  await page.evaluate(() => { const w = MG.game.world; w.events.trigger('blackout'); w.events.trigger('blackhole'); w.events.trigger('titan'); });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, '08-events.png') });

  // Mobil görünüm
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await serveLocal(mobile);
  mobile.on('pageerror', e => errors.push('mobile pageerror: ' + e.message));
  await mobile.goto(url);
  await mobile.waitForTimeout(1000);
  await mobile.screenshot({ path: path.join(OUT, '09-mobile-menu.png') });
  await mobile.fill('#nick', 'Mobil');
  await mobile.tap('#play-btn');
  await mobile.waitForTimeout(1500);
  await mobile.screenshot({ path: path.join(OUT, '10-mobile-play.png') });

  const fps = await page.evaluate(() => MG.game.fps);
  console.log('FPS (headless):', fps.toFixed(1));
  await browser.close();

  if (external.length) console.log('DIŞ İSTEKLER:\n' + external.join('\n'));
  if (errors.length) {
    console.log('HATALAR:\n' + errors.join('\n'));
    process.exit(1);
  }
  console.log('Tarayıcı testi geçti ✓  (' + OUT + ')');
})().catch(e => { console.error(e); process.exit(1); });
