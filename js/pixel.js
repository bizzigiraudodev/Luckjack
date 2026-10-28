// Sprites pixel art dibujados como mapas de caracteres y convertidos a SVG.
(function (root) {
  // Convierte un mapa (array de strings) en <rect>s. Cada carácter es un color de la paleta;
  // '.' es transparente. Junta los píxeles seguidos del mismo color para generar menos rects.
  function rects(map, palette, ox = 0, oy = 0) {
    let out = '';
    map.forEach((row, y) => {
      let x = 0;
      while (x < row.length) {
        const ch = row[x];
        let w = 1;
        while (row[x + w] === ch) w++;
        if (ch !== '.' && ch !== ' ' && palette[ch]) {
          out += `<rect x="${x + ox}" y="${y + oy}" width="${w}" height="1" fill="${palette[ch]}"/>`;
        }
        x += w;
      }
    });
    return out;
  }

  function svg(width, height, body, cls = '') {
    return `<svg class="${cls}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges" aria-hidden="true">${body}</svg>`;
  }

  // --- Palos (7x7) ---
  const SUITS = {
    '♠': ['...#...', '..###..', '.#####.', '#######', '#######', '...#...', '..###..'],
    '♥': ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'],
    '♦': ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'],
    '♣': ['..###..', '..###..', '##.#.##', '#######', '##.#.##', '...#...', '..###..'],
  };
  const SUIT_COLORS = { '♠': '#2b3a67', '♥': '#e2383f', '♦': '#f0762b', '♣': '#1f8a70' };

  function suit(s, cls = 'pip') {
    return svg(7, 7, rects(SUITS[s], { '#': SUIT_COLORS[s] }), cls);
  }

  // --- Crupier (32x34) ---
  const P = {
    K: '#1e1a24', // contorno
    H: '#3b2416', h: '#6b4428', // pelo
    V: '#43c46e', v: '#25854a', // visera
    S: '#f2b48c', s: '#d68a64', // piel
    W: '#f4efe6', w: '#c9c1b4', // camisa
    R: '#b3333f', r: '#7a1f2b', // chaleco
    B: '#ff4f5e', // moño
    G: '#f5c542', // botones
    E: '#1e1a24', // ojos
    m: '#8a3b2b', // boca
    D: '#7fd4ff', // gota de sudor
  };

  const BODY = [
    '..........KKKKKKKKKKKK..........',
    '........KKHHHHHHHHHHHHKK........',
    '.......KHHHhhhHHHHHHHHHHK.......',
    '......KVVVVVVVVVVVVVVVVVVK......',
    '.....KvvvvvvvvvvvvvvvvvvvvK.....',
    '......KKKKKKKKKKKKKKKKKKKK......',
    '.......KHSSSSSSSSSSSSSSSHK......',
    '......KsKSSSSSSSSSSSSSSSKsK.....',
    '......KsKSSSSSSSSSSSSSSSKsK.....',
    '.......KKSSSSSSSSSSSSSSSKK......',
    '........KSSSSSSSsSSSSSSSK.......',
    '........KSSSSSSSsSSSSSSSK.......',
    '........KSSSHHHHHHHHHSSSK.......',
    '........KSSHHSSSSSSSHHSSK.......',
    '........KSSSSSSSSSSSSSSSK.......',
    '.........KSSSSSSSSSSSSSK........',
    '..........KKSSSSSSSSSKK.........',
    '...........KsssssssssK..........',
    '.......KKKKKWWBBKBBWWKKKKK......',
    '.....KKRRRRKWWBBGBBWWKRRRRKK....',
    '....KRRRRRRRKWWWBWWWKRRRRRRRK...',
    '....KRRRRRRRRKWWWWWKRRRRRRRRK...',
    '....KRrRRRRRRRKWWWKRRRRRRRrRK...',
    '....KRrRRRRRRRRKWKRRRRRRRRrRK...',
    '....KRrRRRRRRRRRKRRRRRRRRRrRK...',
    '....KRrRRRRRRRRRGRRRRRRRRRrRK...',
    '....KRrRRRRRRRRRRRRRRRRRRRrRK...',
    '....KRrRRRRRRRRRGRRRRRRRRRrRK...',
    '....KRrRRRRRRRRRRRRRRRRRRRrRK...',
    '....KRrRRRRRRRRRGRRRRRRRRRrRK...',
    '....KRrRRRRRRRRRRRRRRRRRRRrRK...',
    '....KRrRRRRRRRRRRRRRRRRRRRrRK...',
    '....KRRRRRRRRRRRRRRRRRRRRRRRK...',
    '....KKKKKKKKKKKKKKKKKKKKKKKKK...',
  ];
  const EYES = ['EE......EE', 'EE......EE'];
  const MOUTH = ['.mmmmm.'];
  const MOUTH_HAPPY = ['m.....m', '.mmmmm.'];
  const MOUTH_SAD = ['.mmmmm.', 'm.....m'];
  const SWEAT = ['.D', 'DD', 'DD'];
  // Brazos: cuelgan desde los hombros (pivote arriba).
  const ARM = [
    '.KKK.',
    'KWWWK',
    'KWWWK',
    'KWWWK',
    'KWWwK',
    'KWWwK',
    'KWWwK',
    'KWWwK',
    'KWWwK',
    'KSSSK',
    'KSSsK',
    '.KKK.',
  ];

  function dealer() {
    const body = rects(BODY, P);
    return svg(32, 34, [
      `<g class="arm arm-l">${rects(ARM, P, 0, 19)}</g>`,
      `<g class="arm arm-r">${rects(ARM, P, 27, 19)}</g>`,
      body,
      `<g class="eyes">${rects(EYES, P, 11, 8)}</g>`,
      `<g class="mouth mouth-neutral">${rects(MOUTH, P, 13, 14)}</g>`,
      `<g class="mouth mouth-happy">${rects(MOUTH_HAPPY, P, 13, 14)}</g>`,
      `<g class="mouth mouth-sad">${rects(MOUTH_SAD, P, 13, 14)}</g>`,
      `<g class="sweat">${rects(SWEAT, P, 27, 5)}</g>`,
    ].join(''), 'dealer-sprite');
  }

  const Pixel = { rects, svg, suit, dealer, SUIT_COLORS };
  if (typeof module !== 'undefined' && module.exports) module.exports = Pixel;
  else root.Pixel = Pixel;
})(typeof window !== 'undefined' ? window : globalThis);
