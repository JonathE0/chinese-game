/**
 * A short fade to black and back — used to hide a jump (a night's sleep, src/ui/rest.js) that has
 * nothing worth animating in between. `between` runs once the screen is fully black; the fade
 * back in starts right after it returns, and `onDone` fires once the veil is gone. Modeled on the
 * metro ride scene in `ui/metro.js`: a small overlay appended to `#app`, torn down when it is
 * done. The veil covers input for its whole lifetime (see `.fade-veil` in `src/style.css`), so a
 * stray click or key press cannot land mid-transition.
 */
const FADE_MS=400;   // each way

/** `hold` keeps the veil clear for that many milliseconds before it starts to darken: it still
 *  covers input, so something can play out on screen first (the hop into bed). */
export function fadeThrough(between,{duration=FADE_MS,hold=0,onDone}={}){
  const host=document.querySelector('#app');
  const veil=document.createElement('div');
  veil.className='fade-veil';
  veil.style.transitionDuration=duration+'ms';
  host.appendChild(veil);
  setTimeout(()=>{
    // Force layout before the class that starts the transition, or the browser can fold both
    // style changes into one frame and skip the fade-in entirely.
    veil.getBoundingClientRect();
    veil.classList.add('opaque');
    setTimeout(()=>{
      between?.();
      veil.classList.remove('opaque');
      setTimeout(()=>{veil.remove();onDone?.();},duration);
    },duration);
  },hold);
}
