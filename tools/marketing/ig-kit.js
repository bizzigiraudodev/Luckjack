// Genera las imágenes de Instagram (perfil, destacadas y publicaciones) con el arte del juego.
// Uso: node tools/marketing/ig-kit.js → marketing/instagram/img/*.png
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
  const out = path.join(__dirname, '../../marketing/instagram/img');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + path.join(__dirname, 'ig-kit.html'));
  const images = await page.evaluate(() => window.buildKit());
  for (const [name, dataUrl] of Object.entries(images)) {
    fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
  }
  await browser.close();
  console.log(`${Object.keys(images).length} imágenes en ${path.relative(process.cwd(), out)}`);
  if (errors.length) console.log('errores:', errors.join(' | '));
})();
