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
            { who: 'diablo', text: 'Ah, un detallecito: de cada cuatro empates, uno me lo quedo yo. Je, je.' },
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

  root.Story = { intro, cycleIntro, victory, defeat };
})(window);
