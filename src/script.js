import { VideoConferenceApp } from './VideoConferenceApp.js';

// --- Elementos del DOM ---
const localVideo = document.getElementById('localVideo');
const btnMute    = document.getElementById('btnMute');
const btnCam     = document.getElementById('btnCam');
const btnShare   = document.getElementById('btnShare');
const btnLayout  = document.getElementById('btnLayout');
const btnLeave   = document.getElementById('btnLeave');
const connDot    = document.getElementById('connDot');
const connText   = document.getElementById('connText');
const pList      = document.getElementById('participants');
const pCount     = document.getElementById('pCount');

function setConn(ok){
  connDot.classList.toggle('ok', ok);
  connDot.classList.toggle('err', !ok);
  connText.textContent = ok ? 'Conectado' : 'Desconectado';
}

function renderParticipants(ids){
  if(!Array.isArray(ids)) return;
  pList.innerHTML = '';
  ids.forEach(id=>{
    const li = document.createElement('li');
    li.textContent = id;
    pList.appendChild(li);
  });
  pCount.textContent = ids.length;
}

// --- Inicialización de la Aplicación ---
async function main() {
  try {
    const app = new VideoConferenceApp(localVideo);
    window.app = app;                // expón para handlers
    await app.start();

    // Estado WebSocket
    const ws = app.wsManager?.ws;
    if (ws) {
      setConn(ws.readyState === 1);
      ws.addEventListener('open',  () => setConn(true));
      ws.addEventListener('close', () => setConn(false));
      ws.addEventListener('error', () => setConn(false));
    }

    // Participantes (lee de tus peerConnections)
    setInterval(()=>{
      const ids = Array.from(app.peerManager?.peerConnections?.keys?.() || []);
      renderParticipants(ids);
    }, 1500);

    // -------- Controles --------
    btnMute?.addEventListener('click', () => {
      const a = app.peerManager?.localStream?.getAudioTracks?.()[0];
      if(!a) return;
      a.enabled = !a.enabled;                           // false = silenciado
      btnMute.classList.toggle('active', !a.enabled);
      btnMute.title = !a.enabled ? 'Activar micrófono (M)' : 'Silenciar (M)';
    });

    btnCam?.addEventListener('click', () => {
      const v = app.peerManager?.localStream?.getVideoTracks?.()[0];
      if(!v) return;
      v.enabled = !v.enabled;                           // false = cámara off
      btnCam.classList.toggle('active', !v.enabled);
      btnCam.title = !v.enabled ? 'Encender cámara (V)' : 'Apagar cámara (V)';
      localVideo.classList.toggle('mirror', v.enabled);
    });

    let sharing = false;
    btnShare?.addEventListener('click', async () => {
      try{
        if(!sharing){
          const ds = await navigator.mediaDevices.getDisplayMedia({ video:true, audio:false });
          const screen = ds.getVideoTracks()[0];

          app.peerManager?.peerConnections?.forEach(pc=>{
            const sender = pc.getSenders().find(s=>s.track && s.track.kind==='video');
            if(sender) sender.replaceTrack(screen);
          });

          const audioTracks = app.peerManager?.localStream?.getAudioTracks?.() || [];
          localVideo.srcObject = new MediaStream([ ...audioTracks, screen ]);
          screen.onended = () => btnShare.click();

          sharing = true;
          btnShare.classList.add('active');
        }else{
          const cam = app.peerManager?.localStream?.getVideoTracks?.()[0];
          if (cam){
            app.peerManager?.peerConnections?.forEach(pc=>{
              const sender = pc.getSenders().find(s=>s.track && s.track.kind==='video');
              if(sender) sender.replaceTrack(cam);
            });
            localVideo.srcObject = app.peerManager?.localStream;
          }
          sharing = false;
          btnShare.classList.remove('active');
        }
      }catch(e){ console.error('screen share:', e); }
    });

    let alt = false;
    btnLayout?.addEventListener('click', () => {
      const grid = document.getElementById('videoGrid');
      alt = !alt;
      grid.style.gridTemplateColumns = alt ? 'repeat(1, minmax(280px,1fr))' : '';
    });

    btnLeave?.addEventListener('click', () => {
      try{
        app.peerManager?.peerConnections?.forEach(pc=>pc.close());
        app.peerManager?.peerConnections?.clear?.();
        app.peerManager?.localStream?.getTracks?.().forEach(t=>t.stop());
        app.wsManager?.ws?.close?.();
      }finally{
        location.reload();
      }
    });

    // Atajos
    document.addEventListener('keydown', (e)=>{
      const k = e.key.toLowerCase();
      if(k==='m') btnMute?.click();
      if(k==='v') btnCam?.click();
      if(k==='s') btnShare?.click();
      if(k==='q') btnLeave?.click();
    });

  } catch (error) {
    console.error('Fallo al iniciar la aplicación:', error);
  }
}

main().catch(console.error);
