"""Build the game's Blender assets headless: `npm run models` (all) or `npm run models -- jars lantern`.

Runs inside Blender (`blender --background --factory-startup --python scripts/blender/build.py -- [names]`).
Each recipe is scripts/blender/recipes/<name>.py (underscores for the hyphens of the asset name) with a
`build()` that returns a finished lib.Asset. Writes public/models/<name>.glb and
scripts/blender/previews/<name>.png, and prints one line of stats per asset.
"""
import importlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

wanted = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
names = wanted or sorted(f[:-3].replace('_', '-') for f in os.listdir(os.path.join(HERE, 'recipes'))
                         if f.endswith('.py') and not f.startswith('_'))
failed = []
for name in names:
    try:
        recipe = importlib.import_module('recipes.' + name.replace('-', '_'))
        print('MODEL ' + json.dumps(recipe.build().finish()), flush=True)
    except Exception as err:  # keep going, report at the end
        import traceback
        traceback.print_exc()
        failed.append(name)
if failed:
    print('MODEL FAILED ' + ' '.join(failed), flush=True)
    sys.exit(1)
