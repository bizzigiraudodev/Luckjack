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

  // Crea un personaje a partir del cuerpo del crupier: `rows` reemplaza filas enteras
  // (ya con sus colores finales) y `swap` cambia colores en el resto de las filas.
  function derive({ rows = {}, swap = {}, post = null }) {
    const out = BODY.map((row, y) => (rows[y] !== undefined ? rows[y] : [...row].map((ch) => swap[ch] || ch).join('')));
    if (post) post(out);
    return out;
  }

  // Pinta franjas horizontales en las filas indicadas (para el poncho).
  function stripe(map, ys, from, to) {
    for (const y of ys) map[y] = map[y].split(from).join(to);
  }

  const BASE = { K: P.K, E: P.E, m: P.m, D: P.D };

  const CHARACTERS = {
    crupier: { body: BODY, palette: P, arm: { W: P.W, w: P.w, S: P.S, s: P.s } },

    gaucho: {
      body: derive({
        rows: {
          0: '..........KKKKKKKKKKKK..........',
          1: '.........KHHHHHHHHHHHHK.........',
          2: '.........KrrrrrrrrrrrrK.........',
          3: '..KKKKKKKHHHHHHHHHHHHHHKKKKKKK..',
          4: '.KHHHHHHHHHHHHHHHHHHHHHHHHHHHHK.',
          5: '..KKKKKKKKKKKKKKKKKKKKKKKKKKKK..',
          12: '........KSWWWWWWWWWWWWWSK.......',
          13: '........KWWWWSSSSSSSWWWWK.......',
          14: '........KWSSSSSSSSSSSSSWK.......',
        },
        swap: { H: 'g', h: 'g', R: 'P', r: 'p', W: 'B', G: 'Y' },
        post: (m) => stripe(m, [24, 28], 'P', 'Y'),
      }),
      palette: { ...BASE, H: '#2b2420', r: '#7a3b1e', g: '#cfcfcf', S: '#dfa07a', s: '#b97a58',
        W: '#f4f4f4', B: '#c8323c', P: '#8c4a2f', p: '#5e2f1d', Y: '#e0a84a' },
      arm: { W: '#8c4a2f', w: '#5e2f1d', S: '#dfa07a', s: '#b97a58' },
    },

    diablo: {
      body: derive({
        rows: {
          0: '......KK................KK......',
          1: '.....KkK................KkK.....',
          2: '.....KkkK..KKKKKKKKKK..KkkK.....',
          3: '......KkkKKHHHHHHHHHHKKkkK......',
          4: '.......KKHHHHHhhHHHHHHHKK.......',
          5: '.......KHHHHHHHHHHHHHHHHK.......',
          12: '........KSSSSHHHHHHHSSSSK.......',
          16: '..........KKSSSSHSSSSKK.........',
          17: '...........KsssHHHsssK..........',
        },
        swap: { V: 'H', v: 'H', R: 'J', r: 'j', B: 'T', G: 'T' },
      }),
      palette: { ...BASE, H: '#1a1420', h: '#3d2a44', k: '#3b2630', S: '#d9473f', s: '#a82f2c',
        E: '#ffd23f', m: '#3b0d12', W: '#f4efe6', J: '#26222e', j: '#3d3550', T: '#e0262f' },
      arm: { W: '#26222e', w: '#3d3550', S: '#d9473f', s: '#a82f2c' },
    },

    santo: {
      body: derive({
        rows: {
          0: '..........GGGGGGGGGGGG..........',
          1: '........GG............GG........',
          2: '..........GGGGGGGGGGGG..........',
          3: '..........KKKKKKKKKKKK..........',
          4: '........KKSSSSSSSSSSSSKK........',
          5: '.......KSSSSSSSSSSSSSSSSK.......',
          6: '.......KwSSSSSSSSSSSSSSSwK......',
          12: '........KwSSSSSSSSSSSSSwK.......',
          13: '........KwwSSSSSSSSSSSwwK.......',
          14: '........KwwSSSSSSSSSSSwwK.......',
          15: '.........KwwwwwwwwwwwwwK........',
          16: '..........KwwwwwwwwwwwK.........',
          17: '...........KwwwwwwwwwK..........',
          18: '.......KKKKKKwwwwwwwKKKKKK......',
          19: '.....KKNNNNKWWwwwwwWWKNNNNKK....',
          20: '....KNNNNNNNKWWwwwWWKNNNNNNNK...',
        },
        swap: { H: 'w', h: 'w', R: 'N', r: 'n', B: 'W', G: 'G' },
      }),
      palette: { ...BASE, G: '#ffd84a', w: '#f4f4f4', S: '#f0c7a0', s: '#cf9f78',
        W: '#fbf7ee', N: '#3d6fd1', n: '#28509e' },
      arm: { W: '#3d6fd1', w: '#28509e', S: '#f0c7a0', s: '#cf9f78' },
    },

    // El jugador en la intro: un timbero viejo con sombrero.
    timbero: {
      body: derive({
        rows: {
          0: '................................',
          1: '..........KKKKKKKKKKKK..........',
          2: '.........KFFFFFFFFFFFFK.........',
          3: '.........KffffffffffffK.........',
          4: '......KKKFFFFFFFFFFFFFFKKK......',
          5: '.....KKKKKKKKKKKKKKKKKKKKKK.....',
          12: '........KSSSSSSSSSSSSSSSK.......',
          13: '........KSSSSSSSSSSSSSSSK.......',
        },
        swap: { H: 'g', h: 'g', R: 'A', r: 'a', B: 'T', G: 'K' },
      }),
      palette: { ...BASE, F: '#5b4636', f: '#2e231b', g: '#d6d6d6', S: '#f0b48c', s: '#d08a64',
        W: '#f4efe6', A: '#4a4f63', a: '#353848', T: '#c8323c' },
      arm: { W: '#4a4f63', w: '#353848', S: '#f0b48c', s: '#d08a64' },
    },
  };

  function character(id) {
    const c = CHARACTERS[id] || CHARACTERS.crupier;
    const pal = c.palette;
    const armPal = { K: P.K, ...c.arm };
    return svg(32, 34, [
      `<g class="arm arm-l">${rects(ARM, armPal, 0, 19)}</g>`,
      `<g class="arm arm-r">${rects(ARM, armPal, 27, 19)}</g>`,
      rects(c.body, pal),
      `<g class="eyes">${rects(EYES, pal, 11, 8)}</g>`,
      `<g class="mouth mouth-neutral">${rects(MOUTH, pal, 13, 14)}</g>`,
      `<g class="mouth mouth-happy">${rects(MOUTH_HAPPY, pal, 13, 14)}</g>`,
      `<g class="mouth mouth-sad">${rects(MOUTH_SAD, pal, 13, 14)}</g>`,
      `<g class="sweat">${rects(SWEAT, P, 27, 5)}</g>`,
    ].join(''), `dealer-sprite char-${id}`);
  }

  function dealer() {
    return character('crupier');
  }

  // Mate con bombilla, para la mesa del gaucho (8x10).
  const MATE = ['....GG..', '....G...', '...KGK..', '.KKKGKK.', 'KccccccK', 'KcCccccK', 'KcCccccK', '.KccccK.', '..KKKK..'];
  function mate() {
    return svg(8, 9, rects(MATE, { K: P.K, G: '#c9ccd6', c: '#7a4a2a', C: '#a8683c' }), 'mate');
  }

  const Pixel = { rects, svg, suit, dealer, character, mate, CHARACTERS, SUIT_COLORS };
  if (typeof module !== 'undefined' && module.exports) module.exports = Pixel;
  else root.Pixel = Pixel;
})(typeof window !== 'undefined' ? window : globalThis);
