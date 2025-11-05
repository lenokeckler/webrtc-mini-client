const showRetry = (show=true) => {
  const b = document.getElementById('btnRetry');
  if (b) b.style.display = show ? 'inline-block' : 'none';
};

async function ensureLocalMedia() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
    });
    // Asegura autoplay:
    let v = document.querySelector('#videos video[data-self="1"]');
    if (!v) {
      v = document.createElement('video');
      v.autoplay = true; v.muted = true; v.playsInline = true; v.dataset.self = '1';
      document.getElementById('videos')?.prepend(v);
    }
    v.srcObject = stream;
    v.addEventListener('loadedmetadata', () => v.play().catch(()=>{}));

    // pasa el stream a tu lógica existente (ajusta nombre según tu app)
    window.app?.webrtc?.setLocalStream?.(stream);

    showRetry(false);
  } catch (err) {
    console.error(err);
    alert(`No se pudo acceder: ${err.name}. Revisa permisos y vuelve a intentar.`);
    showRetry(true);
  }
}

document.getElementById('btnRetry')?.addEventListener('click', ensureLocalMedia);

// Llama a ensureLocalMedia() al iniciar tu app (después de crear window.app)
ensureLocalMedia();
