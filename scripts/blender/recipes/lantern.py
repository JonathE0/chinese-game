"""A red silk lantern (灯笼): a cord and gold top cap, a round body whose silk bulges between twelve
ribs, a gold bottom cap, a knot and a fluted silk tassel. Hangs from its top; origin at the tassel's foot."""
import math

from lib import Asset, lathe

SILK, GOLD, CORD, TASSEL = '#c8402f', '#b48a3c', '#3b2e26', '#b8322a'
PANELS = 12


def build():
    a = Asset('lantern', ao=.1, ground=False)
    # The tassel: fluted, fuller towards the foot, darker at its ends.
    flutes = lambda t: .72 + .28 * abs(math.sin(9 * t))
    tassel = [(0, 0), (.034, .004), (.03, .07), (.021, .15), (.014, .2), (0, .205)]
    a.add(lathe(tassel, 54, flutes), 'cloth', lambda c: '#962a22' if c.z < .03 else TASSEL)
    a.add(lathe([(0, 0), (.02, .006), (.024, .02), (.018, .036), (0, .04)], 16), 'wood', GOLD, at=(0, 0, .2))
    a.add(lathe([(0, 0), (.005, 0), (.005, .07), (0, .07)], 8), 'cloth', CORD, at=(0, 0, .235))
    # Caps, top and bottom: a flat disc with a raised rim and a little turned finial.
    cap = [(0, 0), (.1, 0), (.105, .01), (.1, .035), (.085, .045), (.05, .05), (0, .052)]
    a.add(lathe(cap, 24), 'wood', GOLD, at=(0, 0, .3))
    a.add(lathe(cap, 24), 'wood', GOLD, at=(0, 0, 1.04), rot=(180, 0, 0))
    # The body: twelve silk panels bulging out between the ribs.
    body = []
    for k in range(13):
        t = (k / 12 - .5) * math.pi
        body.append((max(.085, math.cos(t) * .28), .67 + math.sin(t) * .34))
    body = [(0, .345)] + body + [(0, .995)]
    bulge = lambda t: .92 + .08 * math.sin(math.pi * ((t * PANELS / (2 * math.pi)) % 1))
    a.add(lathe(body, PANELS * 4, bulge), 'silk', SILK, mottle=.05)
    # The hanging loop and cord above the top cap.
    a.add(lathe([(0, 0), (.008, 0), (.008, .1), (0, .1)], 8), 'cloth', CORD, at=(0, 0, 1.04))
    a.add(lathe([(.018, -.005), (.027, 0), (.018, .005), (.009, 0)], 12, closed=True), 'wood', GOLD,
          at=(0, 0, 1.15), rot=(90, 0, 0))
    return a
