"""A carved timber lattice window (花窗) in the 灯笼锦 manner: a moulded frame round a lattice cut
from one board, an open 'lantern' at its centre ringed by a second, inner border, short struts, corner
brackets and small carved rosettes (卡子花) where the struts meet. Faces -Y in Blender (+Z in glTF);
origin at the foot of the frame."""
import math

from lib import Asset, box, lathe, panel

FRAME, LATTICE, CARVING = '#5a3a28', '#4a3326', '#6b4630'
W, H, F = .9, 1.2, .07        # outside size and frame width
BAR, DEPTH = .022, .03


def build():
    a = Asset('lattice-window', ao=.08, ground=False)
    # The frame, and a bead moulding just inside it.
    for x, z, sx, sz in ((0, F / 2, W, F), (0, H - F / 2, W, F), (-(W - F) / 2, H / 2, F, H - 2 * F), ((W - F) / 2, H / 2, F, H - 2 * F)):
        a.add(box(sx, .06, sz, .008, 2), 'wood', FRAME, at=(x, 0, z), grain=True)
    ix, iz0, iz1 = W / 2 - F, F, H - F
    for x, z, sx, sz in ((0, iz0 + .008, 2 * ix, .016), (0, iz1 - .008, 2 * ix, .016), (-ix + .008, H / 2, .016, iz1 - iz0), (ix - .008, H / 2, .016, iz1 - iz0)):
        a.add(box(sx, .045, sz, .006), 'wood', FRAME, at=(x, -.004, z), grain=True)
    # The lattice: a grid cut round a central opening, an inner border inside the opening joined to
    # the outer one by short struts, and brackets in the opening's corners.
    h = BAR / 2
    xs = [-.285, -.19, -.095, 0, .095, .19, .285]
    zs = [iz0 + (iz1 - iz0) * k / 10 for k in range(1, 10)]
    ox, oz0, oz1 = .19, zs[2], zs[6]                 # the opening's border lies on grid bars
    rects = []
    for x in xs:
        if abs(x) < ox - .01:
            rects += [(x - h, x + h, iz0, oz0 + h), (x - h, x + h, oz1 - h, iz1)]
        else:
            rects.append((x - h, x + h, iz0, iz1))
    for z in zs:
        if oz0 + .01 < z < oz1 - .01:
            rects += [(-ix, -ox + h, z - h, z + h), (ox - h, ix, z - h, z + h)]
        else:
            rects.append((-ix, ix, z - h, z + h))
    g = .045                                          # the inner border's inset
    rects += [(-ox + g - h, ox - g + h, oz0 + g - h, oz0 + g + h), (-ox + g - h, ox - g + h, oz1 - g - h, oz1 - g + h),
              (-ox + g - h, -ox + g + h, oz0 + g, oz1 - g), (ox - g - h, ox - g + h, oz0 + g, oz1 - g)]
    mz = (oz0 + oz1) / 2
    rects += [(-ox, -ox + g, mz - h, mz + h), (ox - g, ox, mz - h, mz + h), (-h, h, oz0, oz0 + g), (-h, h, oz1 - g, oz1)]
    for sx in (-1, 1):
        for sz, z0 in ((1, oz0 + g), (-1, oz1 - g)):
            x0 = sx * (ox - g)
            rects += [(min(x0, x0 - sx * .07), max(x0, x0 - sx * .07), min(z0, z0 + sz * .018), max(z0, z0 + sz * .018)),
                      (min(x0, x0 - sx * .018), max(x0, x0 - sx * .018), min(z0, z0 + sz * .07), max(z0, z0 + sz * .07))]
    a.add(panel(rects, DEPTH, .003), 'wood', LATTICE, grain=True)
    # Rosettes: four-petalled carved flowers on the struts and on the bars beside the opening.
    petals = lambda t: .72 + .28 * abs(math.cos(2 * t))
    rosette = [(0, -.019), (.03, -.019), (.03, .017), (.013, .027), (0, .028)]
    for x, z in ((-ox + g / 2, mz), (ox - g / 2, mz), (0, oz0 + g / 2), (0, oz1 - g / 2),
                 (-.285, zs[4]), (.285, zs[4]), (0, zs[0]), (0, zs[8])):
        a.add(lathe(rosette, 16, petals), 'wood', CARVING, at=(x, 0, z), rot=(90, 0, 0))
    return a
