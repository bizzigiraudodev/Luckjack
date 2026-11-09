# Dorso del mazo de truco: verde oscuro con borde ajedrezado beige y dos óvalos entrelazados.
import os; os.chdir(os.path.dirname(os.path.abspath(__file__)))  # las salidas quedan al lado del script
import math
W, H = 22, 34
G, L, D, O = '#123f36', '#e3b77a', '#0b2a24', '#c8743a'  # verde, beige, verde oscuro, naranja
px = [[G] * W for _ in range(H)]
def ring(i, col):
    for x in range(i, W - i):
        px[i][x] = col; px[H - 1 - i][x] = col
    for y in range(i, H - i):
        px[y][i] = col; px[y][W - 1 - i] = col
ring(0, L)
# ajedrezado
for x in range(1, W - 1):
    for y in (1, H - 2):
        px[y][x] = L if (x + y) % 2 else D
for y in range(1, H - 1):
    for x in (1, W - 2):
        px[y][x] = L if (x + y) % 2 else D
ring(2, L)
ring(3, D)
# dos óvalos entrelazados (arriba y abajo) y un rombo en el centro
cx = (W - 1) / 2
def oval(cy, rx, ry, col):
    for y in range(H):
        for x in range(W):
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if abs(math.sqrt(d) - 1) * min(rx, ry) < 0.55 and 4 <= x < W - 4 and 4 <= y < H - 4:
                px[y][x] = col
oval(12.5, 6.0, 6.5, L)
oval(20.5, 6.0, 6.5, L)
cy = (H - 1) / 2
for y in range(H):
    for x in range(W):
        if abs(x - cx) + abs(y - cy) <= 2.0: px[y][x] = O
        # puntitos en las esquinas del campo
for (x, y) in [(5, 5), (W - 6, 5), (5, H - 6), (W - 6, H - 6)]:
    px[y][x] = O
for (y) in [7, H - 8]:
    px[y][int(cx)] = O; px[y][int(cx) + 1] = O
rects = ''.join(f'<rect x="{x}" y="{y}" width="1" height="1" fill="{px[y][x]}"/>' for y in range(H) for x in range(W) if px[y][x] != G)
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" shape-rendering="crispEdges"><rect width="{W}" height="{H}" fill="{G}"/>{rects}</svg>'
open('back.svg', 'w').write(svg)
from PIL import Image
im = Image.new('RGB', (W, H))
for y in range(H):
    for x in range(W):
        c = px[y][x]; im.putpixel((x, y), tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)))
im.resize((W * 8, H * 8), Image.NEAREST).save('back.png')
im.save('back1x.png', optimize=True)
import base64; open('b64.txt','w').write(base64.b64encode(open('back1x.png','rb').read()).decode())
print(len(svg))
