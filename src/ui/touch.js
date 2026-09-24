import './touch.css';

/**
 * Touch-screen controls. The canvas pointer handlers in town.js already turn a touch on the lower
 * left into the thumbstick and any other touch into a look drag (or, while placing furniture, into
 * putting it down); this adds what a thumb can see and tap. The buttons press the same keys a
 * keyboard would, so jumping, getting up from a seat, remembering a name and turning or cancelling a
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
      '<button type="button" data-code="KeyR" hidden>转</button><button type="button" data-code="KeyX" hidden>取消</button>'+
      '<button type="button" data-code="KeyF" hidden>记住</button><button type="button" data-code="Space">跳</button></div>';
    document.body.append(pad);
    const ring=pad.querySelector('.touch-stick'),knob=ring.firstChild,button=code=>pad.querySelector(`[data-code="${code}"]`);
    const remember=button('KeyF'),placing=[button('KeyR'),button('KeyX')];
    for(const b of pad.querySelectorAll('button'))b.addEventListener('pointerdown',e=>{
      e.preventDefault();
      for(const type of ['keydown','keyup'])dispatchEvent(new KeyboardEvent(type,{code:b.dataset.code}));
    });
    // Each frame: 记住 while something is in the crosshair, 转 and 取消 while placing, and the ring
    // where your thumb went down with the knob showing how far you are pushing.
    town.app.on('update',()=>{
      remember.hidden=!town.looking;
      for(const b of placing)b.hidden=!town.ghost;
      const s=town.stick,active=s.id!==null;
      ring.classList.toggle('active',active);
      ring.style.left=active?`${s.ox}px`:'';ring.style.top=active?`${s.oy}px`:'';
      knob.style.transform=`translate(${s.dx*58}px,${s.dz*58}px)`;
    });
  };
  if(matchMedia('(pointer: coarse)').matches)start();
  else addEventListener('touchstart',start,{once:true,passive:true});
}
