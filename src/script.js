import config from './config.js';
// si ya tienes tu inicialización, conserva lo tuyo:
window.addEventListener('DOMContentLoaded', () => {
  // Atajos de UI
  const $ = s => document.querySelector(s);
  const on = (id, fn) => $(id)?.addEventListener('click', fn);

  // ESTADO de botones
  const btnMute = $('#btnMute');
  const btnCam  = $('#btnCam');
  const btnShare= $('#btnShare');
  const btnLeave= $('#btnLeave');
  const btnLayout = $('#btnLayout');

  // Ejemplos: ajusta si tu objeto es distinto
  on('#btnMute', () => {
    const muted = window.app.webrtc.toggleMic();
    btnMute.classList.toggle('active', muted);
    btnMute.title = muted ? 'Activar micrófono (M)' : 'Silenciar (M)';
  });

  on('#btnCam', () => {
    const off = window.app.webrtc.toggleCam();
    btnCam.classList.toggle('active', off);
    btnCam.title = off ? 'Encender cámara (V)' : 'Apagar cámara (V)';
    // espejar solo local si quieres
    const local = document.querySelector('#videos video[data-self="1"]');
    if(local) local.classList.toggle('mirror', !off);
  });

  let sharing = false;
  on('#btnShare', async () => {
    if(!sharing){
      await window.app.webrtc.startScreenShare();
      sharing = true;
      btnShare.classList.add('active');
    }else{
      window.app.webrtc.stopScreenShare();
      sharing = false;
      btnShare.classList.remove('active');
    }
  });

  on('#btnLeave', () => {
    window.app.webrtc.closeAll();
    window.app.ws?.disconnect?.();
    location.reload();
  });

  // Cambiar layout (ej: forzar 1 columna vs auto-fit)
  let alt = false;
  on('#btnLayout', () => {
    const grid = document.getElementById('videos');
    alt = !alt;
    grid.style.gridTemplateColumns = alt ? 'repeat(1, minmax(240px, 1fr))' : '';
  });

  // Atajos de teclado
  document.addEventListener('keydown', (e) => {
    if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if(e.key.toLowerCase()==='m') btnMute?.click();
    if(e.key.toLowerCase()==='v') btnCam?.click();
    if(e.key.toLowerCase()==='s') btnShare?.click();
    if(e.key.toLowerCase()==='q') btnLeave?.click();
  });
});
