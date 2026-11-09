# Pixel art original 64x68 de los rivales de la pampa, dibujado con figuras (sin calcar imágenes).
# Salida: sprites.json con { id: { map: [...], palette: {letra: color} } } y una lámina de vista previa.
import json, math, os, random
from PIL import Image, ImageDraw

W, H = 64, 68
OUT = os.path.dirname(os.path.abspath(__file__))
OUTLINE = (14, 11, 18, 255)


def hexc(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


class Canvas:
    def __init__(self):
        self.img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.img)

    def poly(self, pts, c):
        self.d.polygon(pts, fill=hexc(c))

    def ell(self, box, c):
        self.d.ellipse(box, fill=hexc(c))

    def rect(self, box, c):
        self.d.rectangle(box, fill=hexc(c))

    def line(self, pts, c, w=1):
        self.d.line(pts, fill=hexc(c), width=w)

    def px(self, x, y, c):
        if 0 <= x < W and 0 <= y < H:
            self.img.putpixel((x, y), hexc(c))

    def get(self, x, y):
        return self.img.getpixel((x, y))

    def outline(self, color=OUTLINE, skip=()):
        src = self.img.copy()
        for y in range(H):
            for x in range(W):
                if src.getpixel((x, y))[3]:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < W and 0 <= ny < H:
                        p = src.getpixel((nx, ny))
                        if p[3] and p[:3] not in skip:
                            self.img.putpixel((x, y), color)
                            break


# ---------------------------------------------------------------- El Futre
def futre():
    c = Canvas()
    G, g = '#7a7a84', '#5a5a64'  # caballo
    # bruma roja en las patas
    for i in range(70):
        random.seed(i)
        x, y = random.randint(4, 58), random.randint(56, 67)
        c.px(x, y, random.choice(['#ff3a3a', '#c8202a', '#ff6a5a']))
    # patas
    for x0 in (14, 22, 40, 47):
        c.rect((x0, 50, x0 + 4, 64), g)
        c.rect((x0, 62, x0 + 4, 64), '#2a2228')
    # cuerpo del caballo
    c.ell((8, 36, 54, 58), G)
    c.ell((10, 46, 52, 58), g)
    # cola
    c.poly([(9, 40), (2, 48), (3, 60), (8, 52), (11, 44)], '#2a2228')
    # cuello y cabeza mirando a la derecha
    c.poly([(38, 40), (44, 20), (52, 14), (58, 16), (56, 26), (50, 42)], G)
    c.poly([(52, 14), (60, 20), (63, 30), (61, 34), (56, 32), (54, 24)], G)
    c.poly([(58, 26), (63, 30), (61, 34), (56, 32)], g)  # hocico
    c.poly([(50, 15), (51, 8), (54, 14)], G)  # orejas
    c.poly([(54, 14), (56, 8), (57, 15)], g)
    c.poly([(44, 20), (50, 12), (52, 16), (46, 26), (42, 34)], '#2a2228')  # crin
    c.px(56, 20, '#ff2a2a'); c.px(57, 20, '#ff2a2a'); c.px(56, 21, '#ff8a6a')  # ojo rojo
    c.line([(53, 18), (59, 28), (52, 30)], '#3a2418')  # brida
    # collar de calaveras sobre el pecho del caballo
    for i, (x, y) in enumerate([(36, 44), (40, 46), (44, 47), (48, 46), (51, 44)]):
        c.rect((x, y, x + 2, y + 2), '#e8e2c8')
        c.px(x, y + 1, '#1a1418'); c.px(x + 2, y + 1, '#1a1418')
    c.line([(35, 43), (52, 43)], '#b8a060')
    # manta de la montura
    c.poly([(16, 36), (36, 36), (38, 48), (14, 48)], '#5a1018')
    c.line([(14, 47), (38, 47)], '#e0b040')
    # piernas del jinete y botas
    c.poly([(20, 34), (28, 34), (26, 50), (20, 50)], '#2a2430')
    c.rect((19, 48, 26, 54), '#141016')
    # torso: dolmán rojo de húsar
    c.poly([(14, 14), (34, 14), (32, 36), (16, 36)], '#9a1424')
    c.poly([(14, 14), (18, 14), (18, 36), (16, 36)], '#6a0c18')
    for y in range(18, 34, 3):  # galones dorados
        c.line([(18, y), (30, y)], '#e0b040')
        c.px(17, y, '#f4d070'); c.px(31, y, '#f4d070')
    c.line([(24, 16), (24, 35)], '#c8962a')
    c.rect((14, 33, 34, 36), '#1e1a24')  # cinturón
    c.rect((23, 33, 25, 35), '#e0b040')
    # pelliza al hombro (izquierda)
    c.poly([(10, 14), (16, 13), (16, 30), (9, 28)], '#4a0a12')
    c.line([(10, 14), (9, 28)], '#d8d0c0')
    # charreteras y cuello
    c.rect((12, 12, 18, 15), '#e0b040')
    c.rect((30, 12, 36, 15), '#e0b040')
    c.rect((19, 10, 29, 14), '#7a0c18')
    # cuello cortado que brilla
    c.ell((20, 7, 28, 12), '#ff3a3a')
    c.ell((22, 8, 26, 11), '#ffb09a')
    for (x, y) in [(21, 4), (25, 2), (27, 5), (19, 6), (24, 0), (29, 3)]:
        c.px(x, y, '#ff5a4a')
    # brazo izquierdo con las riendas
    c.poly([(14, 16), (10, 30), (14, 32), (17, 20)], '#9a1424')
    c.line([(12, 32), (40, 34), (52, 30)], '#3a2418')
    # brazo derecho en alto con el sable
    c.poly([(32, 15), (40, 6), (44, 8), (36, 19)], '#9a1424')
    c.rect((40, 4, 44, 8), '#d8d0c0')  # guante
    c.line([(42, 5), (50, 1), (58, 0), (63, 2)], '#ff2a3a', 2)  # hoja curva
    c.line([(44, 5), (52, 2), (60, 1)], '#ffb0a0')
    c.outline(skip=[hexc(k)[:3] for k in ('#ff3a3a', '#c8202a', '#ff6a5a', '#ff5a4a')])
    return c


# ---------------------------------------------------------------- El Pombero
def pombero():
    c = Canvas()
    body, body2, hair, hair2 = '#15170e', '#1d2013', '#22261a', '#2c3220'
    # hojas del monte adelante (abajo)
    for k, (x, h) in enumerate([(0, 20), (6, 26), (54, 24), (58, 18), (46, 12), (14, 10)]):
        c.poly([(x, 68), (x + 3, 68 - h), (x + 6, 68)], '#1a2a12' if k % 2 else '#22361a')
        c.line([(x + 3, 68), (x + 3, 68 - h + 2)], '#2e4a1e')
    # torso con hombros anchos y peludo
    c.poly([(12, 36), (52, 36), (50, 62), (14, 62)], body)
    c.poly([(12, 36), (20, 36), (18, 62), (14, 62)], body2)
    for x in range(16, 50, 4):  # mechones del pecho
        c.line([(x, 40), (x + 1, 46)], hair)
    # brazos largos colgando hasta abajo, con garras
    c.poly([(12, 36), (6, 44), (4, 62), (9, 62), (14, 46)], body)
    c.poly([(52, 36), (58, 44), (60, 62), (55, 62), (50, 46)], body)
    for x in (4, 6, 8):
        c.line([(x, 62), (x - 1, 66)], '#0e100a')
    for x in (56, 58, 60):
        c.line([(x, 62), (x + 1, 66)], '#0e100a')
    # pelo desgreñado que sobresale del sombrero a los costados
    for k in range(13):
        x = 8 + k * 4
        tip = (x - 2 + (k * 7) % 5, 30 + (k * 5) % 9)
        c.poly([(x, 16), (x + 5, 16), tip], hair if k % 2 else hair2)
    for (x, y, dx) in [(6, 18, -5), (8, 24, -6), (56, 18, 5), (54, 24, 6), (10, 30, -4), (52, 30, 4)]:
        c.poly([(x, y), (x + 2, y + 2), (x + dx, y + 6)], hair)
    # cara en sombra con ojos que brillan
    c.ell((20, 16, 44, 32), '#0b0c07')
    for ex in (25, 36):
        c.rect((ex, 22, ex + 3, 23), '#f4f0c8')
        c.px(ex + 1, 22, '#ffffff'); c.px(ex + 2, 22, '#ffffff')
    # sombrero de paja chato y ancho, en punta
    c.poly([(0, 17), (64, 15), (58, 20), (6, 21)], '#3c3c20')  # ala ancha
    c.poly([(16, 16), (31, 3), (34, 4), (48, 15)], '#48482a')  # copa baja en punta
    c.poly([(31, 3), (34, 4), (42, 11), (36, 11)], '#5c5c34')
    c.line([(16, 15), (48, 14)], '#2a2a16')
    for x in (4, 12, 52, 60):
        c.px(x, 20, '#24240f')  # paja rota
    # un reflejo verde del monte, sutil, en los bordes de arriba a la izquierda
    for y in range(0, 40):
        for x in range(W):
            p = c.get(x, y)
            if p[3] and (x == 0 or not c.get(x - 1, y)[3]) and (x + y) % 2 == 0:
                c.px(x, y, '#3e5424')
    c.outline(color=(6, 8, 4, 255))
    return c


# ---------------------------------------------------------------- El Silbón
def silbon():
    c = Canvas()
    skin, skin2 = '#8fb46a', '#5f8a44'
    # bolsa de huesos sobre el hombro (detrás)
    for box, col in [((30, 4, 50, 24), '#b0b874'), ((36, 10, 62, 34), '#b0b874'), ((30, 18, 54, 42), '#b0b874'),
                     ((40, 26, 60, 42), '#8e9850'), ((32, 30, 48, 42), '#8e9850')]:
        c.ell(box, col)
    c.poly([(30, 10), (26, 12), (25, 16), (31, 16)], '#b0b874')  # boca de la bolsa sobre el hombro
    c.line([(26, 12), (31, 17)], '#5a4028', 2)  # soga
    c.line([(25, 16), (22, 22)], '#5a4028')
    for (x, y) in [(36, 14), (52, 18), (40, 36), (56, 30), (34, 26)]:
        c.line([(x, y), (x + 3, y + 1)], '#7a8244')  # bultos de huesos
    for (x0, y0) in [(44, 22)]:  # calavera que se marca en la tela
        c.ell((x0, y0, x0 + 10, y0 + 9), '#e8e2c8')
        c.rect((x0 + 2, y0 + 9, x0 + 8, y0 + 12), '#e8e2c8')
        c.rect((x0 + 2, y0 + 3, x0 + 3, y0 + 5), '#2a2a1e')
        c.rect((x0 + 7, y0 + 3, x0 + 8, y0 + 5), '#2a2a1e')
        c.px(x0 + 5, y0 + 6, '#2a2a1e')
        for k in range(3, 9, 2):
            c.px(x0 + k, y0 + 10, '#5a5a44')
    c.line([(42, 8), (46, 22)], '#7a8244')  # pliegues
    # piernas flacas con pantalón rotoso (caminando)
    c.poly([(18, 40), (28, 40), (30, 60), (25, 60), (22, 48)], '#5e4430')
    c.poly([(20, 42), (14, 58), (9, 60), (12, 56), (16, 44)], '#4a3424')
    c.poly([(25, 58), (31, 58), (30, 62), (27, 61)], '#4a3424')  # flecos
    c.rect((25, 60, 32, 63), skin2)  # pie descalzo
    c.rect((7, 59, 13, 62), skin2)
    # torso encorvado con camisa celeste gastada
    c.poly([(16, 20), (30, 16), (34, 22), (30, 42), (16, 42), (13, 30)], '#8a9cb0')
    c.poly([(16, 20), (20, 19), (18, 42), (16, 42), (13, 30)], '#6a7c90')
    c.line([(22, 24), (26, 40)], '#6a7c90')
    # brazo largo colgando, mano huesuda abajo
    c.poly([(15, 22), (10, 34), (8, 50), (11, 51), (14, 36), (19, 26)], skin)
    c.poly([(7, 50), (12, 50), (13, 55), (9, 56), (6, 54)], skin2)
    c.line([(7, 55), (6, 58)], skin2); c.line([(10, 56), (10, 59)], skin2)
    # otro brazo: la mano cerca del mentón
    c.poly([(28, 20), (22, 26), (18, 22), (24, 16)], '#8a9cb0')
    c.rect((17, 18, 21, 22), skin)
    # cabeza agachada, de perfil
    c.poly([(12, 10), (24, 8), (26, 14), (24, 20), (16, 22), (12, 18)], skin)
    c.poly([(12, 16), (16, 22), (12, 22), (10, 18)], skin2)  # mandíbula
    c.px(15, 13, '#1a2414'); c.px(16, 13, '#e8e070')  # ojo hundido
    c.line([(13, 18), (17, 19)], '#3a2a1e')  # boca
    c.poly([(24, 8), (28, 12), (26, 18)], '#2a2018')  # pelo
    # sombrero de paja inclinado
    c.poly([(2, 10), (34, 2), (36, 6), (4, 14)], '#c9b46a')
    c.poly([(10, 6), (26, 0), (30, 4), (14, 9)], '#b09a50')
    c.line([(4, 13), (35, 5)], '#8a7638')
    for x in (6, 14, 22, 30):
        c.px(x, 12 - x // 5, '#8a7638')  # paja rota
    c.outline()
    return c


# ---------------------------------------------------------------- El Gauchito Gil
def gil():
    c = Canvas()
    wood, wood2 = '#7a3a26', '#4e2416'
    # la cruz detrás
    c.rect((28, 0, 36, 30), wood)
    c.rect((2, 10, 62, 18), wood)
    c.line([(2, 17), (62, 17)], wood2); c.line([(35, 0), (35, 30)], wood2)
    for x in (6, 58):
        c.px(x, 13, '#2a140c'); c.px(x, 14, '#2a140c')  # clavos
    # pelo largo hasta los hombros
    c.poly([(18, 10), (46, 10), (50, 40), (44, 46), (20, 46), (14, 40)], '#1a1418')
    # cara
    c.poly([(22, 14), (42, 14), (42, 30), (38, 36), (26, 36), (22, 30)], '#c8906a')
    c.poly([(22, 14), (25, 14), (25, 34), (22, 30)], '#a87450')
    # vincha roja
    c.rect((20, 12, 44, 16), '#c8102e')
    c.line([(20, 16), (44, 16)], '#8c0b20')
    c.poly([(44, 12), (50, 16), (48, 20), (44, 16)], '#c8102e')  # nudo
    # cejas y ojos intensos
    c.line([(25, 19), (30, 18)], '#1a1418', 2); c.line([(34, 18), (39, 19)], '#1a1418', 2)
    c.rect((26, 21, 29, 22), '#f0ebe0'); c.rect((35, 21, 38, 22), '#f0ebe0')
    c.rect((27, 21, 28, 22), '#2a1a12'); c.rect((36, 21, 37, 22), '#2a1a12')
    c.line([(32, 21), (31, 27), (33, 27)], '#a87450')  # nariz
    # barba y bigote
    c.poly([(23, 28), (41, 28), (40, 38), (34, 42), (30, 42), (24, 38)], '#1e181c')
    c.rect((29, 30, 35, 31), '#7a3a34')  # boca
    # cuello y camisa blanca abierta
    c.rect((28, 40, 36, 46), '#c8906a')
    c.poly([(8, 46), (56, 46), (60, 68), (4, 68)], '#e8e2d4')
    c.poly([(8, 46), (14, 46), (12, 68), (4, 68)], '#c4bcae')
    c.poly([(50, 46), (56, 46), (60, 68), (52, 68)], '#c4bcae')
    c.poly([(28, 46), (36, 46), (32, 56)], '#c8906a')  # pecho abierto
    # pañuelo rojo anudado
    c.poly([(22, 44), (42, 44), (36, 50), (28, 50)], '#c8102e')
    c.poly([(30, 48), (34, 48), (36, 58), (31, 56)], '#a00c24')
    # manos con boleadoras
    c.rect((22, 56, 30, 61), '#c8906a')  # mano
    c.line([(23, 58), (29, 58)], '#a87450')
    c.line([(24, 61), (20, 66)], '#5a3a24'); c.ell((17, 64, 22, 68), '#7a6a58')
    c.line([(26, 61), (26, 66)], '#5a3a24'); c.ell((24, 64, 29, 68), '#7a6a58')
    c.line([(28, 61), (32, 65)], '#5a3a24'); c.ell((31, 63, 36, 67), '#7a6a58')
    c.outline()
    return c


# ---------------------------------------------------------------- La Luz Mala
def luzmala():
    c = Canvas()
    random.seed(4)
    # oscuridad con trazos rayados
    for y in range(H):
        for x in range(W):
            m = ((x - 31.5) / 32) ** 2 + ((y - 33) / 26) ** 2
            if m < 0.7:
                c.px(x, y, '#0b0b0f')
            elif m < 1 and random.random() < 0.6:
                c.px(x, y, '#141418')
    for i in range(40):  # rayones grises
        x, y = random.randint(4, 58), random.randint(14, 54)
        c.line([(x, y), (x + random.randint(3, 8), y + random.randint(-1, 1))], random.choice(['#1e1e26', '#26262e']))
    # dos ojos enormes, almendrados, con pupila de estrella
    for cx in (18, 45):
        cy = 33
        for y in range(H):
            for x in range(W):
                e = (abs(x - cx) / 11.5) ** 1.6 + ((y - cy) / 6.2) ** 2
                if e < 1:
                    c.px(x, y, '#9a9aa4' if e > 0.78 else '#f4f4f0')
        c.ell((cx - 5, cy - 5, cx + 5, cy + 5), '#141418')
        c.ell((cx - 4, cy - 4, cx + 4, cy + 4), '#050508')
        for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1), (2, 0), (-2, 0), (0, 2), (0, -2), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            c.px(cx + dx, cy + dy, '#ffffff')  # estrella
    return c


# ---------------------------------------------------------------- El Familiar
def familiar():
    c = Canvas()
    d, d2, d3 = '#141016', '#221c26', '#30283a'
    # cuerpo bajo y largo, a la derecha
    c.ell((26, 40, 64, 64), d)
    c.poly([(40, 44), (60, 40), (64, 52), (48, 56)], d2)
    for x0 in (30, 38, 50, 57):  # patas con garras
        c.poly([(x0, 56), (x0 + 4, 56), (x0 + 5, 67), (x0 - 1, 67)], d)
        c.px(x0 - 1, 67, '#8a8aa8'); c.px(x0 + 2, 67, '#8a8aa8')
    # cuello largo en S
    c.poly([(26, 46), (20, 32), (22, 20), (30, 14), (36, 18), (30, 26), (30, 36), (38, 46)], d)
    c.line([(24, 22), (22, 34), (28, 44)], d3)
    for y in range(18, 46, 3):  # púas del lomo
        c.poly([(33 + (y % 2), y), (38 + (y % 2), y - 2), (35, y + 2)], d)
    # cabeza alargada, de perfil hacia la izquierda
    c.poly([(14, 10), (30, 8), (34, 14), (28, 22), (14, 24), (2, 26), (0, 22), (6, 16)], d)
    c.poly([(0, 22), (14, 20), (14, 24), (2, 26)], d2)  # hocico
    # orejas como cuernos
    c.poly([(18, 10), (20, 0), (24, 9)], d)
    c.poly([(25, 9), (30, 1), (31, 11)], d)
    c.line([(20, 2), (21, 8)], d3); c.line([(29, 3), (29, 9)], d3)
    # ojos rojos encendidos con resplandor
    for (x, y) in [(13, 14), (21, 13)]:
        c.ell((x - 3, y - 3, x + 3, y + 3), '#5a0a0a')
        c.ell((x - 2, y - 2, x + 2, y + 2), '#ff2a2a')
        c.px(x, y, '#ffd0a0'); c.px(x - 1, y, '#ff8a6a')
    # colmillos y baba colgando
    for x in (3, 7, 11):
        c.px(x, 25, '#e8e2d8'); c.px(x, 26, '#e8e2d8')
    for x, ln in ((4, 8), (9, 12), (12, 6)):
        c.line([(x, 26), (x, 26 + ln)], '#7a7a96')
        c.px(x, 26 + ln + 1, '#a8a8c8')
    c.outline(color=(6, 4, 8, 255), skip=[hexc('#7a7a96')[:3], hexc('#a8a8c8')[:3]])
    return c


# Estética oscura: apaga y enfría los colores, y suma sombra desde abajo. Lo que brilla
# (ojos rojos, el cuello y el sable del Futre, los ojos de la Luz Mala) se respeta.
GLOWS = {
    'pombero': ['#f4f0c8', '#ffffff', '#3e5424'],
    'futre': ['#ff2a3a', '#ffb0a0', '#ff3a3a', '#ffb09a', '#ff5a4a', '#ff2a2a', '#ff8a6a', '#c8202a', '#ff6a5a'],
    'familiar': ['#ff2a2a', '#ffd0a0', '#ff8a6a', '#5a0a0a'],
    'luzmala': ['#f4f4f0', '#ffffff', '#9a9aa4'],
    'silbon': ['#e8e070'],
    'gil': [],
}


def darken(canvas, sprite_id, amount=0.62):
    keep = {hexc(k)[:3] for k in GLOWS.get(sprite_id, [])}
    for y in range(H):
        shade = amount * (0.82 if y >= H * 0.55 else 1)  # más oscuro en la mitad de abajo
        for x in range(W):
            r, g, b, a = canvas.get(x, y)
            if not a or (r, g, b) in keep:
                continue
            lum = 0.3 * r + 0.59 * g + 0.11 * b
            r2, g2, b2 = [int((c * 0.75 + lum * 0.25) * shade) for c in (r, g, b)]  # menos saturado
            b2 = min(255, b2 + 6)  # un toque frío
            canvas.img.putpixel((x, y), (r2, g2, b2, a))


def to_map(canvas):
    letters = 'ABCDEFGHIJLMNOPQRSTUVWXYZabcdefghijlmnopqrstuvwxyz0123456789!#$%&*+-/:;<=>?@^_~'
    pal = {}
    rows = []
    for y in range(H):
        row = ''
        for x in range(W):
            p = canvas.get(x, y)
            if not p[3]:
                row += '.'
                continue
            hx = '#%02x%02x%02x' % p[:3]
            if hx not in pal:
                pal[hx] = letters[len(pal)]
            row += pal[hx]
        rows.append(row)
    return {'map': rows, 'palette': {v: k for k, v in pal.items()}}


if __name__ == '__main__':
    sprites = {'luzmala': luzmala(), 'silbon': silbon(), 'pombero': pombero(), 'familiar': familiar(), 'gil': gil()}
    for k, v in sprites.items():
        darken(v, k, 0.9 if k == 'luzmala' else 0.62)
    out = {k: to_map(v) for k, v in sprites.items()}
    json.dump(out, open(os.path.join(OUT, 'sprites64.json'), 'w'))
    sheet = Image.new('RGBA', (len(sprites) * (W * 4 + 16) + 16, H * 4 + 32), (58, 48, 54, 255))
    for i, (k, v) in enumerate(sprites.items()):
        sheet.alpha_composite(v.img.resize((W * 4, H * 4), Image.NEAREST), (16 + i * (W * 4 + 16), 16))
    sheet.save(os.path.join(OUT, 'preview.png'))
    print({k: len(v['palette']) for k, v in out.items()})
