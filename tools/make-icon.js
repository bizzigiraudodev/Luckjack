// Genera el ícono de la app (mate del Viejo + tres cartas bravas: 1 espada, 7 oro, 6 basto)
// reutilizando el pixel art real de js/pixel.js. Escribe icons/icon.svg y, en el directorio que
// le pases como argumento, dos wrappers HTML a pantalla completa para rasterizar con Chrome headless.
//   node tools/make-icon.js <dir-de-salida-para-los-html>
const fs = require('fs');
const path = require('path');
const P = require('../js/pixel.js');

// Dígitos 3x5 para el número de cada carta.
const D = { 1: ['.#.', '##.', '.#.', '.#.', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'], 6: ['.##', '#..', '##.', '#.#', '.##'] };
const place = (s, x, y, w, h) => s.replace('<svg', `<svg x="${x}" y="${y}" width="${w}" height="${h}"`);

function card(n, s, rot) {
  const col = P.SPANISH_COLORS[s];
  const pip = place(P.spanishSuit(s), -37, -140, 74, 74);
  const num = `<svg x="-50" y="-170" width="20" height="34" viewBox="0 0 3 5" shape-rendering="crispEdges">${P.rects(D[n], { '#': col })}</svg>`;
  return `<g transform="translate(300 352) rotate(${rot})"><rect x="-58" y="-176" width="116" height="176" rx="12" fill="url(#card)" stroke="#1e1a24" stroke-width="6"/>${num}${pip}</g>`;
}

function build(maskable) {
  const mate = place(P.mate('gaucho'), 30, 236, 180, 180); // grande y adelante: el mate es el foco
  const content = `<circle cx="256" cy="256" r="196" fill="none" stroke="#f2c14e" stroke-opacity="0.45" stroke-width="6"/>`
    + `${card(1, 'espada', -30)}${card(6, 'basto', 30)}${card(7, 'oro', 0)}${mate}`;
  // En el maskable el recorte come los bordes: encojo el contenido a la zona segura, el paño llena todo.
  const inner = maskable ? `<g transform="translate(256 256) scale(0.8) translate(-256 -256)">${content}</g>` : content;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>`
    + `<radialGradient id="felt" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#22995e"/><stop offset=".6" stop-color="#146b40"/><stop offset="1" stop-color="#0a3d24"/></radialGradient>`
    + `<linearGradient id="card" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ece6d8"/></linearGradient>`
    + `</defs><rect width="512" height="512" fill="url(#felt)"/>${inner}</svg>`;
}

const wrap = (svg) => `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0}svg{display:block;width:100vw;height:100vh}</style>${svg}`;

const outDir = process.argv[2] || '.';
fs.writeFileSync(path.join(__dirname, '../icons/icon.svg'), build(false) + '\n');
fs.writeFileSync(path.join(outDir, 'icon-std.html'), wrap(build(false)));
fs.writeFileSync(path.join(outDir, 'icon-mask.html'), wrap(build(true)));
console.log('ok: icons/icon.svg + wrappers en', outDir);
