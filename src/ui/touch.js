import './touch.css';
import {codeOf} from '../core/keys.js';

/**
 * Touch-screen controls. The canvas pointer handlers in town.js already turn a touch on the lower
 * left into the thumbstick and any other touch into a look drag (or, while placing furniture, into
 * putting it down); this adds what a thumb can see and tap. The buttons press whichever keys the
 * player has bound, so jumping, getting up from a seat, remembering a name and turning or cancelling a
 * piece of furniture all run through town.js's own key handling. The interact button is the HUD's
 * own #interact button, which already says what E would do and is already tappable.
 */
export function installTouch(town){
  let on=false;
  const start=()=>{
    if(on)return;on=true;
    document.body.classList.add('touch');
    const pad=document.createElement('div');pad.className='touch-pad';
    pad.innerHTML='<div class="touch-stick" aria-hidden="true"><i></i></div><div class="touch-buttons">'+
      '<button type="button" data-action="rotate" hidden>转</button><button type="button" data-action="cancel" hidden>取消</button>'+
      '<button type="button" data-action="collect" hidden>记住</button><button type="button" data-action="jump">跳</button>'+
      '<button type="button" data-action="camera">相机</button><button type="button" data-shutter hidden>拍照</button></div>';
    document.body.append(pad);
    const ring=pad.querySelector('.touch-stick'),knob=ring.firstChild,button=action=>pad.querySelector(`[data-action="${action}"]`);
    const remember=button('collect'),placing=[button('rotate'),button('cancel')];
    // The shutter is no key: it takes the photo the way a left click does (src/ui/camera.js).
    const shutter=pad.querySelector('[data-shutter]');
    shutter.addEventListener('pointerdown',e=>{e.preventDefault();town.onShutter?.();});
    for(const b of pad.querySelectorAll('button[data-action]'))b.addEventListener('pointerdown',e=>{
      e.preventDefault();
      for(const type of ['keydown','keyup'])dispatchEvent(new KeyboardEvent(type,{code:codeOf(b.dataset.action)}));
    });
    // Each frame: 记住 while something is in the crosshair, 转 and 取消 while placing, and the ring
    // where your thumb went down with the knob showing how far you are pushing.
    town.app.on('update',()=>{
      remember.hidden=!town.looking;
      for(const b of placing)b.hidden=!town.ghost;
      shutter.hidden=!town.viewfinder;
      const s=town.stick,active=s.id!==null;
      ring.classList.toggle('active',active);
      ring.style.left=active?`${s.ox}px`:'';ring.style.top=active?`${s.oy}px`:'';
      knob.style.transform=`translate(${s.dx*58}px,${s.dz*58}px)`;
    });
  };
  if(matchMedia('(pointer: coarse)').matches)start();
  else addEventListener('touchstart',start,{once:true,passive:true});
}
