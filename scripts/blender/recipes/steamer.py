"""A bamboo steamer stack (蒸笼): three tiers and a domed lid, each tier a bent bamboo hoop with
darker binding bands proud of it top and bottom and an overlap seam, the lid's top woven in slats."""
import math

from lib import Asset, box, lathe

BAMBOO, BAND, SLAT = '#c8a66a', '#a8834f', '#bd9a60'
R, H, WALL, SEG = .17, .085, .01, 32


def tier(asset, r, h, z, turn):
    """A hoop whose profile steps out for the binding bands; its band faces take the band colour."""
    b, out = .02, .005
    profile = [(r - WALL, 0), (r + out, 0), (r + out, b), (r, b), (r, h - b), (r + out, h - b), (r + out, h), (r - WALL, h)]
    band = lambda c: BAND if math.hypot(c.x, c.y) > r + out * .5 else BAMBOO
    asset.add(lathe(profile, SEG, closed=True), 'bamboo', band, at=(0, 0, z), rot=(0, 0, turn), grain=True)
    # The seam where the bamboo sheet overlaps itself.
    a = math.radians(turn)
    asset.add(box(.035, .006, h - 2 * b, .002), 'bamboo', BAND, at=(math.cos(a) * (r + .002), math.sin(a) * (r + .002), z + h / 2),
              rot=(0, 0, turn + 90), grain=True)


def weave(c):
    """Radial slats over and under concentric rings, a shade apart."""
    a = math.atan2(c.y, c.x) % (2 * math.pi)
    ring = int(math.hypot(c.x, c.y) / .028)
    return SLAT if (int(a / (2 * math.pi / 48)) + ring) % 2 else BAMBOO


def build():
    a = Asset('steamer', ao=.06)
    for i, turn in enumerate((20, 145, 260)):
        tier(a, R, H, i * H, turn)
    z, r = 3 * H, R + .007
    tier(a, r, .05, z, 80)
    rw = r - WALL
    dome = [(0, .03), (rw, .03)] + [(rw * t, .036 + .03 * (1 - t * t)) for t in (1, .83, .67, .5, .33, .17, 0)]
    a.add(lathe(dome, 48), 'bamboo', weave, at=(0, 0, z))
    return a
