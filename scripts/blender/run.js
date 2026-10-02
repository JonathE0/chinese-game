// `npm run models [-- names]`: rebuild the Blender assets headless (scripts/blender/build.py).
// BLENDER overrides where Blender lives.
import {spawnSync} from 'node:child_process';
const blender=process.env.BLENDER||'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';
const run=spawnSync(blender,['--background','--factory-startup','--python-exit-code','1','--python','scripts/blender/build.py','--',...process.argv.slice(2)],{stdio:'inherit'});
if(run.error)console.error(`Blender not found at ${blender} (set BLENDER): ${run.error.message}`);
process.exit(run.status??1);
