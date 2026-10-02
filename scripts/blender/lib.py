"""Shared helpers for the Blender asset recipes (scripts/blender/recipes/*.py).

A recipe builds one asset out of parts: each part is a bmesh (a box, a turned shape, a tube or a flat
carved panel), a material name and a colour. `Asset.finish` joins the parts into one object (one glTF
primitive per material, so one draw call per material), bakes ambient occlusion into the vertex
colours with Cycles, exports public/models/<name>.glb and renders a small preview PNG.

Conventions the game's loader (src/world/assets.js) relies on:
- metres, origin at the centre of the asset's base, glTF +Y up (Blender +Z up, front towards -Y);
- the colour lives in the vertex colours (COLOR_0, linear): base colour x baked AO, gently mottled;
- UVs are in metres (one UV unit = one metre), so the game's painted surfaces tile at their own scale;
- material names are keys of `materials` in src/content/models.json (wood, bamboo, ceramic, ...).
Everything is deterministic: no downloads, seeded jitter, fixed Cycles seed.
"""
import math
import os
import random

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector, noise

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'models')
PREVIEWS = os.path.join(os.path.dirname(__file__), 'previews')

# Only for the Blender preview render; the game uses its own materials (src/content/models.json).
PREVIEW_ROUGHNESS = {'ceramic': .22, 'silk': .65}
PREVIEW_GLOW = {'silk': .3}


def linear(hex_colour):
    """An sRGB hex colour as linear RGB."""
    h = hex_colour.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4)
    return out


# ── Shapes, as bmesh, in local metres ───────────────────────────────────────────────────────────

def box(sx, sy, sz, bevel=0.0, segments=1):
    """A box sx x sy x sz centred on the origin, every edge chamfered by `bevel`."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts:
        v.co = Vector((v.co.x * sx, v.co.y * sy, v.co.z * sz))
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(bevel, sx * .45, sy * .45, sz * .45),
                        segments=segments, profile=.5, affect='EDGES', clamp_overlap=True)
    return bm


def lathe(profile, seg=24, radial=None, closed=False):
    """A profile [(radius, height), ...] turned about +Z. Start and end it on the axis (radius 0) for a
    closed solid, or pass closed=True for a ring whose profile is a loop. `radial(angle)` scales the
    radius round the turn (lantern panels, petals, flutes)."""
    bm = bmesh.new()
    rings = []
    for j in range(seg):
        a = 2 * math.pi * j / seg
        k = radial(a) if radial else 1.0
        rings.append([bm.verts.new((r * k * math.cos(a), r * k * math.sin(a), z)) for r, z in profile])
    m = len(profile)
    spans = range(m) if closed else range(m - 1)
    # UVs in metres: round the widest girth, and along the profile (one seam, so few split vertices).
    girth = max(r for r, _ in profile)
    along = [0.0]
    for k in range(1, m + 1):
        p, q = profile[k - 1], profile[k % m]
        along.append(along[-1] + math.hypot(q[0] - p[0], q[1] - p[1]))
    uv = bm.loops.layers.uv.new('UVMap')
    for j in range(seg):
        a, b = rings[j], rings[(j + 1) % seg]
        u0, u1 = 2 * math.pi * girth * j / seg, 2 * math.pi * girth * (j + 1) / seg
        for k in spans:
            k2 = (k + 1) % m
            f = bm.faces.new((a[k], b[k], b[k2], a[k2]))
            for loop, st in zip(f.loops, ((u0, along[k]), (u1, along[k]), (u1, along[k + 1]), (u0, along[k + 1]))):
                loop[uv].uv = st
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-7, edges=list(bm.edges))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    return bm


def tube(points, radius, radii=None, sides=2):
    """A round tube along a smooth curve through `points`, capped, `radius` thick (times `radii`
    per point, for a tapering spout). `sides` is Blender's bevel resolution (2: eight sides)."""
    cu = bpy.data.curves.new('tube', 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = sides
    cu.use_fill_caps = True
    cu.resolution_u = 5
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(points) - 1)
    for i, p in enumerate(sp.bezier_points):
        p.co = points[i]
        p.handle_left_type = p.handle_right_type = 'AUTO'
        p.radius = radii[i] if radii else 1.0
    obj = bpy.data.objects.new('tube', cu)
    bpy.context.scene.collection.objects.link(obj)
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    bm = bmesh.new()
    bm.from_mesh(evaluated.to_mesh())
    evaluated.to_mesh_clear()
    bpy.data.objects.remove(obj)
    bpy.data.curves.remove(cu)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    return bm


def panel(rects, depth, bevel=0.0):
    """A flat carved panel in the XZ plane, `depth` thick along Y: the union of rectangles
    (x0, x1, z0, z1), one connected solid with bevelled outer edges (a lattice cut from one board)."""
    xs = sorted({round(v, 6) for r in rects for v in r[:2]})
    zs = sorted({round(v, 6) for r in rects for v in r[2:]})
    inside = lambda x, z: any(r[0] < x < r[1] and r[2] < z < r[3] for r in rects)
    bm = bmesh.new()
    verts = {}
    vert = lambda i, j: verts.get((i, j)) or verts.setdefault((i, j), bm.verts.new((xs[i], -depth / 2, zs[j])))
    for i in range(len(xs) - 1):
        for j in range(len(zs) - 1):
            if inside((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2):
                bm.faces.new((vert(i, j), vert(i + 1, j), vert(i + 1, j + 1), vert(i, j + 1)))
    bm = _refill(bm)
    out = bmesh.ops.extrude_face_region(bm, geom=list(bm.faces))
    bmesh.ops.translate(bm, vec=(0, depth, 0), verts=[v for v in out['geom'] if isinstance(v, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    if bevel > 0:
        # The edges round the faces, not the short ones running through the board's depth.
        edges = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > 1.0
                 and abs((e.verts[1].co - e.verts[0].co).normalized().y) < .5]
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=1, profile=.5, affect='EDGES', clamp_overlap=True)
    return bm


def _refill(cells):
    """The grid cells' outline (outer edge and holes), straight runs collapsed to their ends, filled
    again with as few triangles as the outline needs (the grid's inner points add nothing but cost)."""
    edges = [e for e in cells.edges if len(e.link_faces) == 1]
    on = {}
    for e in edges:
        for v in e.verts:
            on.setdefault(v, []).append(e)

    def straight(v):
        if len(on[v]) != 2:
            return False
        a, b = (e.other_vert(v).co - v.co for e in on[v])
        return a.normalized().dot(b.normalized()) < -.9999

    bm = bmesh.new()
    new = {v: bm.verts.new(v.co) for v in on if not straight(v)}
    done = set()
    for v in new:
        for e in on[v]:
            prev, cur, step = v, e.other_vert(v), e
            while cur not in new:
                step = next(x for x in on[cur] if x is not step)
                prev, cur = cur, step.other_vert(cur)
            key = frozenset((v, cur))
            if key not in done:
                done.add(key)
                bm.edges.new((new[v], new[cur]))
    cells.free()
    bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=list(bm.edges), normal=(0, -1, 0))
    return bm


# ── The asset ──────────────────────────────────────────────────────────────────────────────────

class Asset:
    """One asset being built. `ao`: how far (metres) occlusion reaches; `ground`: whether it stands on
    a floor that darkens its foot (False for hanging or wall pieces)."""

    def __init__(self, name, ao=.12, ground=True, floor=.38):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        self.name, self.ao, self.ground, self.floor = name, ao, ground, floor
        self.rand = random.Random(name)
        self.parts = []

    def add(self, bm, material, colour, at=(0, 0, 0), rot=(0, 0, 0), jitter=.06, mottle=.07, sharp=40, grain=False):
        """Add a part: `colour` a hex, or a function of a face's local centre (x, y, z) giving one
        (bands, unglazed feet, woven slats). `rot` in degrees. `sharp`: edges creased above this angle.
        `grain`: run the texture's v along the part's longest side (timber)."""
        # UVs in metres, projected along each face's main axis, before the part is placed.
        lo = Vector((min(v.co[a] for v in bm.verts) for a in range(3)))
        hi = Vector((max(v.co[a] for v in bm.verts) for a in range(3)))
        size = hi - lo
        uv = bm.loops.layers.uv.get('UVMap')
        projected = uv is None
        if projected:
            uv = bm.loops.layers.uv.new('UVMap')
        col = bm.loops.layers.float_color.new('base')
        k = 1 + (self.rand.random() - .5) * jitter
        place = Matrix.Translation(at) @ Euler([math.radians(d) for d in rot]).to_matrix().to_4x4()
        for f in bm.faces:
            n = f.normal
            a = max(range(3), key=lambda i: abs(n[i]))
            ua, va = ((0, 1) if a == 2 else (1, 2) if a == 0 else (0, 2))
            if grain and size[ua] > size[va]:
                ua, va = va, ua
            c = linear(colour(f.calc_center_median()) if callable(colour) else colour)
            for loop in f.loops:
                co = loop.vert.co
                if projected:
                    loop[uv].uv = (co[ua], co[va])
                w = place @ co
                m = k * (1 + mottle * (noise.noise(w * 9) * .7 + noise.noise(w * 31) * .3))
                loop[col] = (*(min(1, ch * m) for ch in c), 1)
        bm.transform(place)
        for f in bm.faces:
            f.smooth = True
        for e in bm.edges:
            e.smooth = not (len(e.link_faces) == 2 and math.degrees(e.calc_face_angle(0)) > sharp)
        mesh = bpy.data.meshes.new(self.name)
        bm.to_mesh(mesh)
        bm.free()
        mesh.materials.append(material_for(material))
        obj = bpy.data.objects.new(self.name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        self.parts.append(obj)
        return obj

    def finish(self, preview=True):
        """Join, bake AO into the colours, export the .glb, render the preview; returns the stats."""
        scene, layer = bpy.context.scene, bpy.context.view_layer
        bpy.ops.object.select_all(action='DESELECT')
        for o in self.parts:
            o.select_set(True)
        layer.objects.active = self.parts[0]
        bpy.ops.object.join()
        obj = layer.objects.active
        obj.name = self.name
        mesh = obj.data

        floor = None
        if self.ground:
            floor = bpy.data.objects.new('floor', bpy.data.meshes.new('floor'))
            fb = box(40, 40, .01)
            bmesh.ops.translate(fb, vec=(0, 0, -.0055), verts=list(fb.verts))
            fb.to_mesh(floor.data)
            fb.free()
            floor.data.materials.append(material_for('studio-floor', '#b9b3a8'))
            scene.collection.objects.link(floor)

        scene.render.engine = 'CYCLES'
        scene.cycles.device = 'CPU'
        scene.cycles.seed = 0
        scene.world = bpy.data.worlds.new('studio')
        scene.world.light_settings.distance = self.ao
        scene.cycles.samples = 128
        # AO per vertex, not per face corner: smooth across faces, and corners that share a vertex
        # stay one glTF vertex, which keeps the file small.
        ao = mesh.color_attributes.new('ao', 'FLOAT_COLOR', 'POINT')
        mesh.color_attributes.active_color = ao
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        layer.objects.active = obj
        bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')

        n = len(mesh.loops)
        base, occ = np.empty(n * 4, np.float32), np.empty(len(mesh.vertices) * 4, np.float32)
        corner_vert = np.empty(n, np.int32)
        mesh.loops.foreach_get('vertex_index', corner_vert)
        mesh.color_attributes['base'].data.foreach_get('color', base)
        mesh.color_attributes['ao'].data.foreach_get('color', occ)
        base, occ = base.reshape(-1, 4), occ.reshape(-1, 4)[corner_vert, :1]
        base[:, :3] *= self.floor + (1 - self.floor) * occ
        final = mesh.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
        final.data.foreach_set('color', base.ravel())
        for gone in ('base', 'ao'):
            mesh.color_attributes.remove(mesh.color_attributes[gone])
        mesh.color_attributes.active_color = mesh.color_attributes['Col']
        mesh.color_attributes.render_color_index = mesh.color_attributes.find('Col')

        os.makedirs(OUT, exist_ok=True)
        path = os.path.join(OUT, self.name + '.glb')
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True,
                                  export_apply=True, export_vertex_color='MATERIAL', export_cameras=False,
                                  export_lights=False, export_extras=False, export_animations=False)
        corners = [Vector(c) for c in obj.bound_box]
        stats = {'name': self.name, 'triangles': sum(len(p.vertices) - 2 for p in mesh.polygons),
                 'materials': [m.name for m in mesh.materials], 'bytes': os.path.getsize(path),
                 'size': [round(max(c[a] for c in corners) - min(c[a] for c in corners), 3) for a in range(3)]}
        if preview:
            render_preview(obj, os.path.join(PREVIEWS, self.name + '.png'))
        return stats


def material_for(name, hex_colour=None):
    """The Blender material called `name`: its colour from the vertex colours (or `hex_colour`)."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except AttributeError:
        pass
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Roughness'].default_value = PREVIEW_ROUGHNESS.get(name, .75)
    if hex_colour:
        bsdf.inputs['Base Color'].default_value = (*linear(hex_colour), 1)
        return m
    attr = m.node_tree.nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'Col'
    m.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    if name in PREVIEW_GLOW:
        m.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Emission Color'])
        bsdf.inputs['Emission Strength'].default_value = PREVIEW_GLOW[name]
    return m


def render_preview(obj, path, size=320):
    """A small three-quarter render of `obj` on the studio floor, for a quick look."""
    scene = bpy.context.scene
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    lo = Vector([min(c[a] for c in corners) for a in range(3)])
    hi = Vector([max(c[a] for c in corners) for a in range(3)])
    centre, extent = (lo + hi) / 2, (hi - lo).length
    cam = bpy.data.objects.new('camera', bpy.data.cameras.new('camera'))
    cam.data.lens = 70
    look = Vector((.55, -1, .5)).normalized()
    cam.location = centre + look * extent * 2.3
    cam.rotation_euler = (-look).to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(cam)
    scene.camera = cam
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3.2
    sun.data.angle = math.radians(12)
    sun.rotation_euler = (math.radians(42), 0, math.radians(30))
    scene.collection.objects.link(sun)
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value = (.62, .64, .66, 1)
    bg.inputs['Strength'].default_value = .9
    scene.view_settings.view_transform = 'Standard'
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.render.render(write_still=True)
