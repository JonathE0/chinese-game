"""A tea set on a slatted wooden tray: a round clay teapot (a curved spout, a looped handle, a lid
with a knob) and four small porcelain cups with blue rims."""
from lib import Asset, box, lathe, tube

CLAY, TRAY, CUP, RIM = '#6e4234', '#5a3a28', '#eceee9', '#3d5a8a'
TOP = .03   # the tray's slats, where the pot and cups stand


def build():
    a = Asset('teaset', ao=.05)
    # The tray: a base, a raised rim and slats across the top.
    a.add(box(.42, .28, .02, .004), 'wood', TRAY, at=(0, 0, .01), grain=True)
    for x, y, sx, sy in ((0, .13, .42, .02), (0, -.13, .42, .02), (.2, 0, .02, .24), (-.2, 0, .02, .24)):
        a.add(box(sx, sy, .036, .005), 'wood', TRAY, at=(x, y, .018), grain=True)
    for i in range(7):
        a.add(box(.03, .24, .01, .003), 'wood', '#664430', at=(-.165 + i * .055, 0, .025), grain=True)
    # The teapot, at the back left.
    px, py, z = -.08, .02, TOP
    pot = [(0, 0), (.042, 0), (.046, .006), (.062, .025), (.067, .045), (.06, .068), (.046, .08), (.037, .084), (0, .084)]
    a.add(lathe(pot, 28), 'ceramic', CLAY, at=(px, py, z))
    lid = [(0, 0), (.039, 0), (.039, .004), (.03, .01), (.013, .016), (.01, .02), (.016, .027), (.01, .033), (0, .034)]
    a.add(lathe(lid, 28), 'ceramic', CLAY, at=(px, py, z + .082))
    spout = [(px + .05, py, z + .03), (px + .085, py, z + .042), (px + .103, py, z + .07), (px + .112, py, z + .09)]
    a.add(tube(spout, .012, [1.35, 1, .8, .68]), 'ceramic', CLAY)
    handle = [(px - .055, py, z + .066), (px - .088, py, z + .07), (px - .1, py, z + .046),
              (px - .086, py, z + .022), (px - .058, py, z + .022)]
    a.add(tube(handle, .0065), 'ceramic', CLAY)
    # Four cups, front right: white porcelain, a blue line round the rim, hollow inside.
    cup = [(0, 0), (.016, 0), (.017, .004), (.026, .02), (.03, .035), (.027, .035), (.023, .021), (.013, .009), (0, .009)]
    rim = lambda c: RIM if c.z > .03 else CUP
    for x, y in ((.07, -.055), (.135, -.055), (.07, .055), (.135, .055)):
        a.add(lathe(cup, 24), 'ceramic', rim, at=(x, y, TOP))
    return a
