// Integra con tu app actual
import config from './config.js';
import VideoConferenceApp from './VideoConferenceApp.js';

// =====================
// 1) Instanciar y exponer la app
// =====================
const app = new VideoConferenceApp(config);
window.app = app;                // <-- para que los botones puedan usarla

(async () => {
  try {
    await app.start?.();         // respeta tu flujo actual
  } catch (err) {
    console.error('Error iniciando la app:', err);
  }
})();

// =====================
// 2) Utilidades UI
// =====================
const $ = s => document.querySelector(s);

function updateConnectionStatus(ok){
  const dot = $('#connectionDot');
  const txt = $('#connectionText');
  if(!dot || !txt) return;
  dot.classList.toggle('ok', !!ok);
  dot.classList.toggle('err', !ok);
  txt.textContent = ok ? 'Conectado' : 'Desconectado';
}

function renderParticipants(listLike){
  const list = $('#participants');
  const count = $('#count');
  if(!list || !count) return;
  const arr = Array.isArray(listLike)
    ? listLike
    : (listLike && listLike.size !== undefined ? Array.from(listLike.keys()) : []);
  list.innerHTML = '';
  arr.forEach(id=>{
    const li = document.createElement('li');
    li.textContent = id;
    list.appendChild(li);
  });
  count.textContent = arr.length;
}

// Poll suave para pintar participantes si tu app mantiene app.participants (Map/array)
setInterval(() => {
  renderParticipants(window.app?.participants || window.app?.webrtc?.participants);
}, 1500);

// Actualizar estado según WebSocket si tu app expone socket
function hookWS(){
  const sock = window.app?.ws?.socket || window.app?.socket;
  if(!sock) { updateConnectionStatus(false); return; }
  updateConnectionStatus(sock.readyState === 1);
  sock.addEventListener?.('open',   () => updateConnectionStatus(true));
  sock.addEventListener?.('close',  () => updateConnectionStatus(false));
  sock.addEventListener?.('error',  () => updateConnectionStatus(false));
}
setTimeout(hookWS, 800);

// =====================
// 3) Manejo de medios locales (robusto)
// =====================
async function ensureLocalMedia() {
  try {
    const constraints = {
      audio: { echoCancellation: true, noiseSuppression: true },
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    // pinta/prepara el video local
    let v = document.querySelector('#videos video[data-self="1"]');
    if (!v) {
      v = document.createElement('video');
      v.autoplay = true;
      v.muted = true;          // autoplay sin bloqueo
      v.playsInline = true;
      v.dataset.self = '1';
      v.classList.add('mirror');
      $('#videos')?.prepend(v);
    }
    v.srcObject = stream;
    v.addEventListener('loadedmetadata', () => v.play().catch(()=>{}));

    // entrega el stream a tu lógica si expone ese método
    window.app?.webrtc?.setLocalStream?.(stream);

    $('#btnRetry')?.style.setProperty('display','none');
    return true;
  } catch (err) {
    console.error('getUserMedia error:', err);
    alert(`No se pudo acceder a la cámara/mic: ${err.name}. Verifica permisos y reintenta.`);
    $('#btnRetry')?.style.setProperty('display','inline-block');
    return false;
  }
}

// botón de reintento (por permisos del navegador)
$('#btnRetry')?.addEventListener('click', ensureLocalMedia);

// Intenta al cargar
ensureLocalMedia();

// =====================
// 4) Toolbar: Mute / Cam / Share / Layout / Leave
// =====================
const btnMute   = $('#btnMute');
const btnCam    = $('#btnCam');
const btnShare  = $('#btnShare');
const btnLayout = $('#btnLayout');
const btnLeave  = $('#btnLeave');

btnMute?.addEventListener('click', () => {
  const t = window.app?.webrtc?.getLocalStream?.()?.getAudioTracks?.()[0];
  if(!t){ return; }
  t.enabled = !t.enabled;
  btnMute.classList.toggle('active', !t.enabled);               // activo = silenciado
  btnMute.title = !t.enabled ? 'Activar micrófono (M)' : 'Silenciar micrófono (M)';
});

btnCam?.addEventListener('click', () => {
  const t = window.app?.webrtc?.getLocalStream?.()?.getVideoTracks?.()[0];
  if(!t){ return; }
  t.enabled = !t.enabled;
  btnCam.classList.toggle('active', !t.enabled);                 // activo = cámara OFF
  btnCam.title = !t.enabled ? 'Encender cámara (V)' : 'Apagar cámara (V)';
  const local = document.querySelector('#videos video[data-self="1"]');
  if(local) local.classList.toggle('mirror', t.enabled);         // espeja solo si está ON
});

let sharing = false;
btnShare?.addEventListener('click', async () => {
  try{
    if(!sharing){
      const ds = await navigator.mediaDevices.getDisplayMedia({ video:true, audio:false });
      const screen = ds.getVideoTracks()[0];

      // reemplaza la track de video en cada RTCPeerConnection si tu app expone peerConnections
      const pcs = window.app?.webrtc?.peerConnections;
      if(pcs?.forEach){
        pcs.forEach(pc=>{
          const sender = pc.getSenders().find(s=>s.track && s.track.kind==='video');
          if(sender) sender.replaceTrack(screen);
        });
      }
      // pinta en preview local
      const local = document.querySelector('#videos video[data-self="1"]');
      const audioTracks = window.app?.webrtc?.getLocalStream?.()?.getAudioTracks?.() || [];
      if(local) local.srcObject = new MediaStream([ ...audioTracks, screen ]);

      screen.onended = () => btnShare.click();  // al cerrar, restaurar

      sharing = true;
      btnShare.classList.add('active');
    }else{
      // restaurar cámara
      const cam = window.app?.webrtc?.getLocalStream?.()?.getVideoTracks?.()[0];
      const pcs = window.app?.webrtc?.peerConnections;
      if(pcs?.forEach && cam){
        pcs.forEach(pc=>{
          const sender = pc.getSenders().find(s=>s.track && s.track.kind==='video');
          if(sender) sender.replaceTrack(cam);
        });
      }
      const local = document.querySelector('#videos video[data-self="1"]');
      if(local) local.srcObject = window.app?.webrtc?.getLocalStream?.() || local.srcObject;

      sharing = false;
      btnShare.classList.remove('active');
    }
  }catch(e){
    console.error('screen share:', e);
  }
});

let altLayout = false;
btnLayout?.addEventListener('click', () => {
  const grid = $('#videos');
  altLayout = !altLayout;
  grid.style.gridTemplateColumns = altLayout ? 'repeat(1, minmax(240px, 1fr))' : '';
});

btnLeave?.addEventListener('click', () => {
  try{
    window.app?.webrtc?.closeAll?.();
    window.app?.ws?.disconnect?.();
  }finally{
    location.reload();
  }
});

// =====================
// 5) Atajos de teclado
// =====================
document.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if(['input','textarea'].includes(e.target.tagName.toLowerCase())) return;
  if(k==='m') btnMute?.click();
  if(k==='v') btnCam?.click();
  if(k==='s') btnShare?.click();
  if(k==='q') btnLeave?.click();
});
