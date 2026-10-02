"""Three glazed storage jars with lids, as on a grocer's shelf: a tall brown-glazed one, a celadon one
and a small blue-and-white one. Unglazed feet below the glaze."""
from lib import Asset, lathe

BISCUIT, COBALT = '#c4ae93', '#3d5a8a'


def jar(asset, x, y, r, h, glaze, band=False):
    # Points at the band's edges and the glaze line, so the colours change on a crisp edge.
    profile = [(0, 0), (r * .6, 0), (r * .62, h * .035), (r * .8, h * .14), (r * .95, h * .32), (r, h * .52),
               (r * .92, h * .64), (r * .85, h * .74), (r * .82, h * .78), (r * .52, h * .9), (r * .5, h * .96),
               (r * .57, h * .985), (r * .56, h), (r * .42, h), (0, h * .97)]

    def colour(c):
        if c.z < h * .14:          # the faces below the ring at 0.14 h
            return BISCUIT
        if band and h * .64 < c.z < h * .74:
            return COBALT
        return glaze

    asset.add(lathe(profile, 28), 'ceramic', colour, at=(x, y, 0))
    lid = [(0, 0), (r * .6, 0), (r * .6, .012), (r * .38, .03), (r * .14, .046), (r * .12, .058),
           (r * .17, .066), (r * .12, .078), (0, .08)]
    asset.add(lathe(lid, 28), 'ceramic', COBALT if band else glaze, at=(x, y, h))


def build():
    a = Asset('jars', ao=.15)
    jar(a, -.12, .06, .17, .42, '#6b4a33')
    jar(a, .17, .1, .13, .3, '#9db8a6')
    jar(a, .06, -.17, .1, .23, '#eceee9', band=True)
    return a
