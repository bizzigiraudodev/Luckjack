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

  // Cambia un píxel del mapa (fila y, columna x).
  function put(map, y, x, ch) {
    map[y] = map[y].slice(0, x) + ch + map[y].slice(x + 1);
  }

  // La Luz Mala: una mancha de oscuridad con dos ojos enormes que brillan, de pupilas como estrellas.
  function darkEyes() {
    const out = [];
    const eyes = [[9, 15], [22, 15]];
    for (let y = 0; y < 34; y++) {
      let row = '';
      for (let x = 0; x < 32; x++) {
        const mass = ((x - 15.5) / 16) ** 2 + ((y - 15.5) / 11) ** 2;
        let ch = mass < 0.75 ? 'd' : mass < 1 && (x + y) % 2 === 0 ? 'D' : mass < 1.15 && (x * 3 + y) % 5 === 0 ? 'D' : '.';
        for (const [cx, cy] of eyes) {
          const e = ((x - cx) / 5.6) ** 2 + ((y - cy) / 3.1) ** 2;
          const r = Math.hypot(x - cx, y - cy);
          if (e < 1) ch = e > 0.7 ? 'w' : 'W';
          if (r < 2.4) ch = 'K';
          if ((Math.abs(x - cx) < 0.6 && Math.abs(y - cy) < 1.1) || (Math.abs(y - cy) < 0.6 && Math.abs(x - cx) < 1.1)) ch = 's';
        }
        row += ch;
      }
      out.push(row);
    }
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
        post: (m) => stripe(m, [24, 28], 'J', 'T'), // poncho negro con guardas rojas
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
        post: (m) => stripe(m, [24, 28], 'N', 'W'), // poncho celeste y blanco
      }),
      palette: { ...BASE, G: '#ffd84a', w: '#f4f4f4', S: '#f0c7a0', s: '#cf9f78',
        W: '#fbf7ee', N: '#3d6fd1', n: '#28509e' },
      arm: { W: '#3d6fd1', w: '#28509e', S: '#f0c7a0', s: '#cf9f78' },
    },

    // --- Historia del truco en la pampa ---

    // La Luz Mala: en la oscuridad, solo dos ojos enormes con pupilas de estrella.
    luzmala: {
      body: darkEyes(),
      noArms: true,
      noFace: true,
      palette: { ...BASE, d: '#0b0b0f', D: '#1c1c24', W: '#f4f4f0', w: '#9a9aa4', s: '#ffffff' },
      arm: {},
    },

    // El Silbón: flaco y verdoso, sombrero de paja roto, ojos hundidos y la bolsa de huesos al hombro.
    silbon: {
      body: [
        '................................',
        '..........KKKKKKK...............',
        '.........KYYyYYYYK..............',
        '........KYYYyyyYYYK.............',
        '...KKKKKYYYYYYYYYYYKKKKK........',
        '..KYYyYYYYYYyYYYYYYYYyYYK.......',
        '...KKKyKKKKKKKKKKKKKyKKK.....KKK',
        '.........KhhhhhhhhK........KBBBK',
        '.........KGkkGGkkGK.......KBBBBB',
        '.........KGkeGGekGK......KBbBBBB',
        '.........KGGGGGGGGK.....KBBBBbBB',
        '.........KgGGGGGGgK.....KBBWWBBB',
        '..........KGmmmmGK......KBWkWkBB',
        '..........KgGGGGgK......KBWWWWBB',
        '...........KgggggK......KBBWmWBB',
        '..........KKGgggGKK.....KBBBBBbB',
        '........KKCCKGGGKCCKK..KBBBBBBBK',
        '.......KCCCCCKGKCCCCCKKBBBBBBBK.',
        '......KCCcCCCCKCCCCCCGGKBBBBBK..',
        '......KCCcCCCCCCCCCCCKGKBBBBK...',
        '......KCKcCCCCCCCCCCcKGGKKKK....',
        '......KCKcCCCCCCCCCCcKKGK.......',
        '......KGKcCCCCCCCCCCcK.KK.......',
        '......KGKcCCCCCCCCCCcK..........',
        '......KGKPPPPPPPPPPPPK..........',
        '......KGKPPPPKKPPPPPPK..........',
        '.....KGGKPPPPK.KPPPPPK..........',
        '.....KGGKPPPPK.KPPPPPK..........',
        '......KK.KPPPK.KPPPPK...........',
        '.........KPPPK..KPPPK...........',
        '.........KpppK..KpppK...........',
        '........KKKKKK..KKKKKK..........',
        '................................',
        '................................',
      ],
      noArms: true,
      noFace: true,
      palette: { ...BASE, Y: '#c9b46a', y: '#9a8640', h: '#2a3a1e', G: '#7fa05a', g: '#5a7a3e', k: '#141c10', e: '#e8e070',
        m: '#2a1a10', C: '#7a8aa0', c: '#5a6a80', P: '#5e4430', p: '#3e2c1e', B: '#a8b07a', b: '#7a8050', W: '#e8e2c8' },
      arm: {},
    },

    // El Futre: jinete sin cabeza de chaqueta roja con galones, cuello encendido, sable rojo en alto
    // y la cabeza de su caballo, de ojo rojo, con un collar de calaveras.
    futre: {
      body: [
        '............................RR..',
        '...........................RrR..',
        '..........................RrR...',
        '.........................RrR....',
        '............r..r........RrR.....',
        '.............rOr.......RrR......',
        '............KOOOK.....RrR.......',
        '...........KjjOjjK...KNNK.......',
        '.....KKKK.KJJJJJJJK.KNNK........',
        '....KGGGGKJJJJJJJJJKNNK.........',
        '....KGGGKJJGGGGGGGJJNK..........',
        '.....KKJJJJJJGJJJJJJJK..........',
        '......KJJGGGGGGGGGGJJK..........',
        '......KJJJJJJGJJJJJJJK..........',
        '......KJJGGGGGGGGGGJJK..........',
        '......KJJJJJJGJJJJJJJK..........',
        '......KJJGGGGGGGGGGJJK..........',
        '......KjJJJJJGJJJJJJjK..........',
        '......KKKNNNNNNNNNNKKK..........',
        '.......KNNNNNNNNNNNNK...........',
        '..KK...KNNNNNKNNNNNNK...........',
        '.KhhK..KNNNNK.KNNNNNK...........',
        'KhhhhKK.KNNNK.KNNNNK............',
        'KhRhhhhK.KNNK..KNNNK............',
        'KhhhhhhhKKNNK..KNNNK............',
        '.KhhhhhhhhKKK...KKK.............',
        '..KhhhhhhhhK....................',
        '..KWKWKWKWKhK...................',
        '..KhhhhhhhhhhK..................',
        '...KhhKhhhKhhK..................',
        '...KhhK...KhhK..................',
        '...KKKK...KKKK..................',
        '................................',
        '................................',
      ],
      noArms: true,
      noFace: true,
      palette: { ...BASE, R: '#ff2a3a', r: '#a8101e', O: '#ff6a4a', J: '#9a1424', j: '#6a0c18', G: '#e0b040',
        N: '#2a2430', h: '#5a5a66', W: '#e8e2c8' },
      arm: {},
    },

    // El Familiar: bestia negra de cuello largo, orejas como cuernos, ojos rojos encendidos y babeando.
    familiar: {
      body: [
        '.......KK.....KK................',
        '......KdK....KdK................',
        '.....KddK...KddK................',
        '.....KdddK.KdddK................',
        '....KddddKKddddK................',
        '...KddddddddddddK...............',
        '..KddRRddddddRRddK..............',
        '..KdROrRddddROrRdK..............',
        '.KddddRddddddRddddK.............',
        'KddddddddddddddddddK............',
        'KddDDddddddddddddddK............',
        '.KddddddddddddddddddK...........',
        '..KdWdKKKKKKdWddddddK...........',
        '...KWKK....KWKdddddddK..........',
        '...KsK......KsKdddddddK.........',
        '....s........s.KdddddddK........',
        '....s..........KddDdddddK.......',
        '...............KdddDddddddK.....',
        '................KdddDddddddK....',
        '................KddddDdddddddK..',
        '.................KddddDddddddddK',
        '..................KddddddddddddK',
        '..................KdddddddddddK.',
        '.................KddddddddddddK.',
        '................KdddKddddKddddK.',
        '................KddK.KddK.KddK..',
        '................KddK.KddK.KddK..',
        '...............KdddK.KddK.KdddK.',
        '...............KKKK..KKKK.KKKK..',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
      ],
      noArms: true,
      noFace: true,
      palette: { ...BASE, d: '#141016', D: '#2c2632', R: '#ff2a2a', r: '#a01010', O: '#ffd0a0', W: '#e8e2d8', s: '#8a8aa8' },
      arm: {},
    },

    // El Gauchito Gil: pelo largo negro, vincha y pañuelo rojos, barba, camisa blanca y la cruz detrás.
    gil: {
      body: [
        '.............KXXXXK.............',
        '.............KXxxXK.............',
        '.............KXxxXK.............',
        '.KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK.',
        '.KXXXXXXKHHHHHHHHHHHHHHKXXXXXXK.',
        '.KxxxxxKHHHHHHHHHHHHHHHHKxxxxxK.',
        '.KKKKKKKTTTTTTTTTTTTTTTTKKKKKKK.',
        '.......KHKKKKKKKKKKKKKKHK.......',
        '......KHHKSSSSSSSSSSSSKHHK......',
        '......KHHSSSSSSSSSSSSSSHHK......',
        '......KHHSSSSSSSSSSSSSSHHK......',
        '......KHHKSSSSSSsSSSSSSKHHK.....',
        '......KHHKSSSSSSsSSSSSSKHHK.....',
        '......KHHKSSHHHHHHHHHSSKHHK.....',
        '......KHHKSHHSSSSSSSHHSKHHK.....',
        '......KHHKHHHHHHHHHHHHHKHHK.....',
        '......KHHHKHHHHHHHHHHHKHHHK.....',
        '......KHHHHKKHHHHHHHKKHHHHK.....',
        '.......KHHHHKsssssssKHHHHK......',
        '.......KKKKKWWTTKTTWWKKKKK......',
        '.....KKWWWWKWWTTTTTWWKWWWWKK....',
        '....KWWWWWWWKWWWTWWWKWWWWWWWK...',
        '....KWWWWWWWWKWWWWWKWWWWWWWWK...',
        '....KWwWWWWWWWKWWWKWWWWWWWwWK...',
        '....KWwWWWWWWWWKWKWWWWWWWWwWK...',
        '....KWwWWWWWWWWWKWWWWWWWWWwWK...',
        '....KWwWWWWWWWWWWWWWWWWWWWwWK...',
        '....KWwWWWWWWWWWWWWWWWWWWWwWK...',
        '....KWwWWWWWWWWWWWWWWWWWWWwWK...',
        '....KTTTTTTTTTTTTTTTTTTTTTTTK...',
        '....KWwWWWWWWWWWWWWWWWWWWWwWK...',
        '....KWwWWWWWWWWWWWWWWWWWWWwWK...',
        '....KWWWWWWWWWWWWWWWWWWWWWWWK...',
        '....KKKKKKKKKKKKKKKKKKKKKKKKK...',
      ],
      palette: { ...BASE, X: '#6a3a24', x: '#4a2616', H: '#1a1418', T: '#c8102e', S: '#d9a07a', s: '#b57f5c',
        W: '#f0ebe0', w: '#c9c1b4', m: '#7a2a2a' },
      arm: { W: '#f0ebe0', w: '#c9c1b4', S: '#d9a07a', s: '#b57f5c' },
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

  // Caras de las señas del truco: se dibujan encima de los ojos o la boca y se muestran con
  // data-sena="..." en el contenedor del personaje.
  const SENA_FACES = {
    cejas: { x: 10, y: 6, map: ['KKK......KKK'] },
    ceno: { x: 10, y: 6, map: ['KK........KK', '..K......K..'] },
    ojos: { x: 11, y: 8, map: ['SS......SS', 'KK......KK'] },
    guino: { x: 11, y: 8, map: ['........SS', '........KK'] },
    boca_der: { x: 13, y: 13, map: ['....mmm', 'mmmm...'] },
    boca_izq: { x: 13, y: 13, map: ['mmm....', '...mmmm'] },
    labio: { x: 13, y: 13, map: ['..WW...', 'mmmmmmm'] },
    trompa: { x: 14, y: 13, map: ['.mm.', 'm..m', '.mm.'] },
  };

  function character(id) {
    const c = CHARACTERS[id] || CHARACTERS.crupier;
    const pal = c.palette;
    const armPal = { K: P.K, ...c.arm };
    const facePal = { K: P.K, S: pal.S, m: pal.m || P.m, W: '#ffffff' };
    const senas = Object.entries(SENA_FACES)
      .map(([sid, f]) => `<g class="sena sena-${sid}">${rects(f.map, facePal, f.x, f.y)}</g>`).join('');
    // `noArms`: criaturas sin brazos (la Luz Mala); `noFace`: sin cara (el Futre no tiene cabeza).
    const arms = c.noArms ? [] : [
      `<g class="arm arm-l">${rects(ARM, armPal, 0, 19)}</g>`,
      `<g class="arm arm-r">${rects(ARM, armPal, 27, 19)}</g>`,
    ];
    const face = c.noFace ? [] : [
      `<g class="eyes">${rects(EYES, pal, 11, 8)}</g>`,
      `<g class="mouth mouth-neutral">${rects(MOUTH, pal, 13, 14)}</g>`,
      `<g class="mouth mouth-happy">${rects(MOUTH_HAPPY, pal, 13, 14)}</g>`,
      `<g class="mouth mouth-sad">${rects(MOUTH_SAD, pal, 13, 14)}</g>`,
      `<g class="sweat">${rects(SWEAT, P, 27, 5)}</g>`,
      senas,
    ];
    return svg(32, 34, [...arms, rects(c.body, pal), ...face].join(''), `dealer-sprite char-${id}`);
  }

  function dealer() {
    return character('crupier');
  }

  // Mates de la mesa (16x16), uno por jefe:
  // el Viejo, un camionero de cuero con costuras y virola de alpaca cincelada;
  // el Diablo, una pezuña partida en marrón, negro y bordó sangre que chorrea del borde;
  // San Pedro, una calabaza con virola y guarda de filigrana dorada, una cruz y destellos celestiales.
  const MATES = {
    gaucho: {
      map: [
        '...........GG...',
        '..........G.....',
        '.........G......',
        '..KKKKKKKGKKKK..',
        '.KyyyyyyyGyyyyK.',
        '.KAAAAAAAAAAAAK.',
        '.KAeAeAeAeAeAeK.',
        '.KaaaaaaaaaaaaK.',
        '.KcCCCCCCCCCCcK.',
        '.KcCsCCCCCCsCcK.',
        '.KcCCsCCCCsCCcK.',
        '.KcCsCCCCCCsCcK.',
        '.KcCCCCCCCCCCcK.',
        '.KaaaaaaaaaaaaK.',
        '..KAeAeAeAeAeK..',
        '...KKKKKKKKKK...',
      ],
      colors: { G: '#c9ccd6', y: '#6a9a35', A: '#eceef3', a: '#a9adb8', e: '#7d8290', C: '#7a4a24', c: '#4a2a12', s: '#e0b46a' },
    },
    diablo: {
      map: [
        '...........BB...',
        '..........I.....',
        '.........I......',
        '...KKKKKKIKKK...',
        '..KbbbbbbIbbbK..',
        '..KbBbbbbbbBbK..',
        '..KhBhhHhhhBhK..',
        '..KhHhhHhhhhhK..',
        '..KhHhhHhhhhhK..',
        '..KhhhhHhhhhhK..',
        '..KkkkkkKkkkkK..',
        '..KnnnnK.KnnnK..',
        '..KnnnK...KnnK..',
        '...KKK....KKK...',
      ],
      colors: { K: '#0d0709', B: '#a3121f', b: '#6e0c19', I: '#3b3238', h: '#3a1f16', H: '#5a3322', n: '#1a0e0f', k: '#4b352c' },
    },
    santo: {
      map: [
        '.L.........GG..L',
        '..........G.....',
        '.........G...L..',
        '....KKKKKGKKK...',
        '...KOWOWOGOWOK..',
        '...KoOoOoOoOoK..',
        '....KcccccccK...',
        '..KcCccrccrccK..',
        '.KcCcccrccrcccK.',
        '.KOWOWOWOWOWOWK.',
        '.KcCcccWccrcccK.',
        '.KccccWWWcrcccK.',
        '..KcccrWccrccK..',
        '...KKKKKKKKKK...',
        '.L............L.',
      ],
      colors: { G: '#e8c547', L: '#fff6c8', O: '#ffd84a', o: '#c99a1e', W: '#fffbe8', c: '#f2a33a', C: '#ffd27a', r: '#c9761f' },
    },
  };
  function mate(id = 'gaucho') {
    const m = MATES[id] || MATES.gaucho;
    return svg(16, m.map.length, rects(m.map, { K: P.K, ...m.colors }), `mate mate-${id}`);
  }

  // --- Palos españoles (9x9): '#' color principal, '+' detalle ---
  const SPANISH = {
    espada: { map: ['....#....', '....#....', '....#....', '....#....', '....#....', '..+++++..', '....+....', '....+....', '...+++...'],
      colors: { '#': '#5f8fd8', '+': '#e0a84a' } },
    basto: { map: ['...###...', '..#####..', '..##+##..', '...###...', '...#+#...', '...###...', '...#+#...', '...###...', '....#....'],
      colors: { '#': '#9a6a36', '+': '#5e3a1a' } },
    oro: { map: ['..#####..', '.#+++++#.', '#++###++#', '#+#+++#+#', '#+#+++#+#', '#+#+++#+#', '#++###++#', '.#+++++#.', '..#####..'],
      colors: { '#': '#b8860b', '+': '#f5c542' } },
    copa: { map: ['#########', '#+++++++#', '.#+++++#.', '..#+++#..', '...#+#...', '....#....', '....#....', '...###...', '..#####..'],
      colors: { '#': '#a3202a', '+': '#e2383f' } },
  };
  const SPANISH_COLORS = { espada: '#2f5fae', basto: '#7a4a1e', oro: '#b8860b', copa: '#c8323c' };

  function spanishSuit(s, cls = 'pip') {
    return svg(9, 9, rects(SPANISH[s].map, SPANISH[s].colors), cls);
  }

  const Pixel = { rects, svg, suit, spanishSuit, dealer, character, mate, MATES, CHARACTERS, SUIT_COLORS, SPANISH_COLORS };
  if (typeof module !== 'undefined' && module.exports) module.exports = Pixel;
  else root.Pixel = Pixel;
})(typeof window !== 'undefined' ? window : globalThis);
