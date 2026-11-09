# Convierte sprites64.json (salida de draw.py) en js/sprites-pampa.js.
import json, os
H = os.path.dirname(os.path.abspath(__file__))
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../')
data = json.load(open(os.path.join(H, 'sprites64.json')))

# 1) js/sprites-pampa.js con los mapas en alta resolución
lines = ['// Sprites en alta resolución (64x68) de los rivales de la historia del truco en la pampa.',
         '// Pixel art original; se generan con un script de dibujo y se usan desde js/pixel.js.',
         '(function (root) {', '  const PAMPA_SPRITES = {']
for k, v in data.items():
    lines.append(f'    {k}: {{')
    lines.append('      palette: ' + json.dumps(v['palette']).replace('"', "'").replace("':", "': ").replace(", '", ", '") + ',')
    lines.append('      map: [')
    for r in v['map']:
        lines.append(f"        '{r}',")
    lines.append('      ],')
    lines.append('    },')
lines += ['  };', "  if (typeof module !== 'undefined' && module.exports) module.exports = PAMPA_SPRITES;",
          '  else root.PAMPA_SPRITES = PAMPA_SPRITES;', "})(typeof window !== 'undefined' ? window : globalThis);", '']
open(R + 'js/sprites-pampa.js', 'w').write('\n'.join(lines))

