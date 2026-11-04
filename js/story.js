// Guion del modo historia: intro, presentación de cada jefe y finales.
// {name} se reemplaza por el nombre que escribe el jugador.
(function (root) {
  const intro = () => [
    {
      bg: 'casino', music: 'classic', chars: [{ id: 'timbero', pos: 'center' }],
      lines: [
        { who: 'narrador', text: 'Hubo una vez un timbero como no hubo otro.' },
        { who: 'narrador', text: 'Ganó en el hipódromo, en la ruleta, en el truco y en el blackjack. Los casinos le tenían miedo.' },
        { who: 'narrador', text: 'Juntó tanta plata que los crupieres lo saludaban por el nombre... y rezaban para que no se sentara en su mesa.' },
      ],
    },
    {
      bg: 'pampa', music: 'pampa', chars: [{ id: 'timbero', pos: 'left' }],
      lines: [
        { who: 'narrador', text: 'Con la plata hasta el techo, se retiró a una casucha en la pampa.' },
        { who: 'narrador', text: 'Mate, tortas fritas y el horizonte. Nunca más tocó una carta.' },
      ],
    },
    {
      bg: 'noche', chars: [],
      lines: [
        { who: 'narrador', text: 'Y una noche tranquila, de pura vejez, se le terminó la racha.' },
      ],
    },
    {
      bg: 'purgatorio', music: 'gaucho', chars: [],
      lines: [
        { who: 'narrador', text: 'Pero el que vive de la timba... no descansa en paz.' },
        { who: 'narrador', text: 'Abrió los ojos en un lugar gris, lleno de cartas flotando y olor a paño viejo.' },
      ],
    },
    {
      bg: 'purgatorio', chars: [{ id: 'timbero', pos: 'left' }, { id: 'gaucho', pos: 'right' }],
      lines: [
        { who: 'gaucho', text: '¡Aura sí! Otro más que llega. Bienvenido al Purgatorio de los Timberos, m\'hijo.' },
        { who: 'gaucho', text: 'Yo soy el encargado. Hace tanto que estoy acá que me olvidé hasta de mi propio nombre.' },
        { who: 'gaucho', text: '¿Y vos, chamigo? ¿Cómo te llamabas allá arriba?', input: 'name' },
        { who: 'gaucho', text: '{name}... lindo nombre pa\' una lápida. Mirá: acá nadie sale gratis.' },
        { who: 'gaucho', text: 'Tres cuotas tenés que pagar: la mía, la del Diablo pa\' no terminar en el infierno, y la de San Pedro pa\' entrar al Casino del Edén.' },
        { who: 'gaucho', text: 'O si preferís, quedate jugando nomás. Acá el tiempo sobra. ¡Vamos a la mesa!' },
      ],
    },
  ];

  const cycleIntro = (cycle, quota) => {
    if (cycle === 1) {
      return [{
        bg: 'purgatorio', music: 'gaucho', chars: [{ id: 'gaucho', pos: 'center' }],
        lines: [
          { who: 'gaucho', text: 'Bueno, {name}. Primera cuota: la mía.' },
          { who: 'gaucho', text: `Juntame $${quota} en 15 manos. Cada 5 manos te abro la pulpería pa' que compres algo.` },
          { who: 'gaucho', text: 'Si llegás antes a la cuota, podés seguir sumando de a $5 por ronda... o pasar directo. Vos sabrás.' },
          { who: 'gaucho', text: 'Tenés tres mazos. Si no llegás, perdés uno y probás de nuevo. ¡Suerte, chamigo!' },
        ],
      }];
    }
    if (cycle === 2) {
      return [
        {
          bg: 'purgatorio', chars: [{ id: 'gaucho', pos: 'center' }],
          lines: [{ who: 'gaucho', text: '¡Cumpliste conmigo, {name}! Pero ahora viene lo bravo... Cuidate, m\'hijo.' }],
        },
        {
          bg: 'infierno', music: 'diablo', chars: [{ id: 'diablo', pos: 'center' }],
          lines: [
            { who: 'diablo', text: 'Ssssí... {name}. Hace años que te espero. Tantas apuestas, tantas trampas...' },
            { who: 'diablo', text: `Mi cuota es de $${quota}. Si no la pagás, te venís conmigo para abajo.` },
            { who: 'diablo', text: 'Ah, un detallecito: en cada empate me quedo con un cuarto de tu apuesta. Je, je.' },
          ],
        },
      ];
    }
    return [{
      bg: 'cielo', music: 'santo', chars: [{ id: 'santo', pos: 'center' }],
      lines: [
        { who: 'santo', text: 'Paz y bien, {name}. Soy Pedro, el de las llaves.' },
        { who: 'santo', text: `Detrás de esta puerta está el Casino del Edén. La entrada cuesta $${quota}.` },
        { who: 'santo', text: 'Y acá arriba nadie se pone nervioso: el Crupier Nervioso no tiene efecto en mi mesa.' },
      ],
    }];
  };

  const victory = () => [
    {
      bg: 'eden', music: 'eden', chars: [{ id: 'timbero', pos: 'left' }, { id: 'santo', pos: 'right' }],
      lines: [
        { who: 'santo', text: 'Pasá, {name}. Pagaste todas tus deudas.' },
        { who: 'narrador', text: 'Las puertas de oro se abrieron y {name} entró al Casino del Edén.' },
        { who: 'narrador', text: 'Acá las fichas son de oro, el mate siempre está caliente... y de vez en cuando, la casa pierde.' },
      ],
    },
    {
      bg: 'purgatorio', chars: [{ id: 'gaucho', pos: 'center' }],
      lines: [
        { who: 'gaucho', text: '¡Chau, {name}! Acordate de este viejo... aunque yo ya ni me acuerde de mí.' },
        { who: 'narrador', text: '✨ Desbloqueaste el Mazo Dorado: en el modo Infinito vas a empezar con él.' },
      ],
    },
  ];

  const defeat = (kind) => {
    if (kind === 'infierno') {
      return [{
        bg: 'infierno', music: 'triste', chars: [{ id: 'diablo', pos: 'center' }],
        lines: [
          { who: 'diablo', text: 'Je, je, je... Bienvenido a casa, {name}.' },
          { who: 'diablo', text: 'Acá abajo la casa siempre gana. Y la casa... soy yo.' },
          { who: 'narrador', text: '{name} reparte cartas en el infierno. Todas las manos suman 22.' },
        ],
      }];
    }
    if (kind === 'casi') {
      return [{
        bg: 'cielo', music: 'triste', chars: [{ id: 'santo', pos: 'center' }],
        lines: [
          { who: 'santo', text: 'Tan cerca, {name}... Volvé al purgatorio.' },
          { who: 'santo', text: 'Estas puertas se abren solo para el que paga.' },
          { who: 'narrador', text: 'Desde el purgatorio, {name} mira las luces del Edén. Algún día...' },
        ],
      }];
    }
    return [{
      bg: 'purgatorio', music: 'triste', chars: [{ id: 'gaucho', pos: 'center' }],
      lines: [
        { who: 'gaucho', text: 'Se te acabaron los mazos, m\'hijo.' },
        { who: 'gaucho', text: 'Agarrá un banquito y cebame un mate: vas a ser mi ayudante por toda la eternidad.' },
        { who: 'narrador', text: 'Con los siglos, {name} también se olvidó de su propio nombre.' },
      ],
    }];
  };

  // --- Historia del truco: antes del purgatorio, en su retiro en la pampa, el timbero se juega
  // la vida al truco contra cinco personajes del campo, uno por noche.
  const truco = {
    cycleIntro(cycle, quota) {
      const rules = (who, lines) => lines.map((text) => ({ who, text }));
      if (cycle === 1) {
        return [
          {
            bg: 'pampa', music: 'pampa', chars: [{ id: 'timbero', pos: 'center' }],
            lines: rules('narrador', [
              'Antes del purgatorio y de las cuotas, {name} vivía tranquilo en su casucha de la pampa.',
              'Mate, tortas fritas y el horizonte. Había jurado no tocar nunca más una carta.',
            ]),
          },
          {
            bg: 'noche', music: 'triste', chars: [],
            lines: rules('narrador', [
              'Pero el campo, de noche, tiene sus propios jugadores.',
              'Una noche golpearon la puerta. Afuera no había nadie... solo una luz que flotaba.',
            ]),
          },
          {
            bg: 'noche', chars: [{ id: 'timbero', pos: 'left' }, { id: 'luzmala', pos: 'right' }],
            lines: [
              { who: 'luzmala', text: 'Buenas noches, {name}. De chico me seguías por el campo, ¿te acordás?' },
              { who: 'luzmala', text: 'Dicen que sos el mejor timbero del pago. Juguemos un truquito... por tu vida.' },
              { who: 'luzmala', text: `Juntame $${quota} en 15 manos. Si no, venís conmigo a vagar por el campo para siempre.` },
              { who: 'luzmala', text: 'Te voy a mostrar una de mis cartas... pero mi luz trae mala suerte.' },
              { who: 'narrador', text: 'En cada mano apostás y cobrás o pagás la apuesta por la diferencia de puntos. Cada 5 manos, la pulpería.' },
            ],
          },
        ];
      }
      if (cycle === 2) {
        return [
          {
            bg: 'lunallena', music: 'diablo', chars: [],
            lines: rules('narrador', [
              'La noche siguiente se escuchó un silbido: do, re, mi, fa, sol, la, si... subiendo y subiendo.',
              'Si lo escuchás lejos, está cerca. Si lo escuchás cerca... ya es tarde.',
            ]),
          },
          {
            bg: 'lunallena', chars: [{ id: 'silbon', pos: 'center' }],
            lines: [
              { who: 'silbon', text: 'Fiuuu... ¿Escuchaste, {name}? Son los huesos de mi tata, que traigo en la bolsa.' },
              { who: 'silbon', text: `Jugamos por $${quota}. Cada 4 manos silbo bien cerquita... y lo que perdés lo pagás una vez y media.` },
              { who: 'silbon', text: 'Si perdés, tus huesos van a hacerle compañía a los de él.' },
            ],
          },
        ];
      }
      if (cycle === 3) {
        return [
          {
            bg: 'noche', music: 'gaucho', chars: [],
            lines: rules('narrador', ['Por el camino viejo se escuchó un galope. El jinete no tenía cabeza.']),
          },
          {
            bg: 'noche', chars: [{ id: 'futre', pos: 'center' }],
            lines: [
              { who: 'futre', text: '¿Me buscás la cara, {name}? La dejé en la cordillera.' },
              { who: 'futre', text: `Yo voy siempre al galope: soy mano en todas las manos. Mi cuota es de $${quota}.` },
              { who: 'futre', text: 'Si perdés, te llevo en ancas. Para siempre.' },
            ],
          },
        ];
      }
      if (cycle === 4) {
        return [
          {
            bg: 'ingenio', music: 'diablo', chars: [],
            lines: rules('narrador', ['Un perro negro, enorme, apareció en la tranquera. Venía de los ingenios del norte.']),
          },
          {
            bg: 'ingenio', chars: [{ id: 'familiar', pos: 'center' }],
            lines: [
              { who: 'familiar', text: 'Mi patrón firmó un trato: cada año le llevo un peón. Este año sos vos, {name}.' },
              { who: 'familiar', text: `Juntame $${quota}. Y cada 5 manos me como un pedazo de tus fichas. Grrr.` },
            ],
          },
        ];
      }
      return [
        {
          bg: 'santuario', music: 'santo', chars: [],
          lines: rules('narrador', ['La última noche, en el cruce de caminos, flameaban banderas rojas.']),
        },
        {
          bg: 'santuario', chars: [{ id: 'timbero', pos: 'left' }, { id: 'gil', pos: 'right' }],
          lines: [
            { who: 'gil', text: 'Tranquilo, {name}. Soy Antonio Gil. No vengo a asustarte.' },
            { who: 'gil', text: 'Llegó tu hora, hermano. Pero el que juega derecho se gana el descanso.' },
            { who: 'gil', text: `Juguemos un truco honrado: yo no miento y en mi mesa no valen las mentiras. Juntá $${quota}.` },
          ],
        },
      ];
    },
    // `golden`: si se jugó con muerte súbita, la victoria desbloquea el Mazo Dorado.
    victory: (golden = true) => [
      {
        bg: 'santuario', music: 'eden', chars: [{ id: 'timbero', pos: 'left' }, { id: 'gil', pos: 'right' }],
        lines: [
          { who: 'gil', text: 'Jugaste derecho, {name}. Andá tranquilo, que tenés mi bendición.' },
          { who: 'narrador', text: '{name} volvió a su casucha, se cebó un mate y se quedó mirando el horizonte.' },
        ],
      },
      {
        bg: 'noche', music: 'pampa', chars: [],
        lines: [
          { who: 'narrador', text: 'Y una noche tranquila, de pura vejez, se le terminó la racha.' },
          { who: 'narrador', text: 'Pero esa ya es otra historia... la del purgatorio de los timberos.' },
          ...(golden ? [{ who: 'narrador', text: '✨ Desbloqueaste el Mazo Dorado para el truco infinito.' }] : []),
        ],
      },
    ],
    defeat(kind) {
      const ends = {
        luzmala: { bg: 'noche', who: 'luzmala', say: 'Vení, {name}. Seguime...', end: '{name} siguió a la luz por el campo. Nunca más lo vieron.' },
        silbon: { bg: 'lunallena', who: 'silbon', say: 'Fiuuu... Uno más para la bolsa.', end: 'Por los caminos se escucha el silbido... y el ruido de unos huesos nuevos en la bolsa.' },
        futre: { bg: 'noche', who: 'futre', say: 'Subí en ancas, {name}.', end: 'Dicen que los dos galopan por la cordillera, buscando cabezas.' },
        familiar: { bg: 'ingenio', who: 'familiar', say: 'Un peón más para el patrón.', end: 'El Familiar se lo llevó al ingenio. Las chimeneas siguieron humeando.' },
        gil: { bg: 'santuario', who: 'gil', say: 'No es castigo, hermano. Es tu hora.', end: '{name} cerró los ojos... y los abrió en un lugar gris, lleno de cartas flotando.' },
      };
      const e = ends[kind] || ends.luzmala;
      return [{
        bg: e.bg, music: 'triste', chars: [{ id: kind in ends ? kind : 'luzmala', pos: 'center' }],
        lines: [{ who: e.who, text: e.say }, { who: 'narrador', text: e.end }],
      }];
    },
  };

  root.Story = { intro, cycleIntro, victory, defeat, truco };
})(window);
