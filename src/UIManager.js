// UIManager.js

// Soporta ambos contenedores: #videos (nuevo) o #videoGrid (tu id anterior)
const videosRoot =
  document.getElementById('videos') ||
  document.getElementById('videoGrid') ||
  (() => {
    const div = document.createElement('div');
    div.id = 'videos';
    document.body.appendChild(div);
    return div;
  })();

// Helpers mínimos
const $ = (s) => document.querySelector(s);
const byId = (id) => document.getElementById(id);

// Crea una card <div> que envuelve el <video> y una etiqueta
function createVideoCard(userId, opts = {}) {
  const { self = false, label = userId, mirror = self } = opts;

  const card = document.createElement('div');
  card.className = 'video-card';
  card.id = `card-${userId}`;
  card.style.position = 'relative';
  card.style.borderRadius = '12px';
  card.style.overflow = 'hidden';
  card.style.background = '#000';
  card.style.border = '1px solid #1f2937';

  const video = document.createElement('video');
  video.id = `video-${userId}`;
  video.autoplay = true;
  video.playsInline = true;
  video.muted = !!self; // evita eco en local
  video.style.width = '100%';
  video.style.height = '100%';
  video.style.objectFit = 'cover';
  if (mirror) video.classList.add('mirror');

  const tag = document.createElement('div');
  tag.className = 'video-label';
  tag.textContent = label ?? userId;
  Object.assign(tag.style, {
    position: 'absolute',
    left: '8px',
    bottom: '8px',
    padding: '4px 8px',
    borderRadius: '8px',
    fontSize: '12px',
    background: 'rgba(0,0,0,.55)',
    color: '#e6edf3',
    border: '1px solid rgba(255,255,255,.12)',
    pointerEvents: 'none'
  });

  card.appendChild(video);
  card.appendChild(tag);
  videosRoot.appendChild(card);
  return { card, video };
}

/**
 * Gestiona la creación y eliminación de elementos de video y algunos HUD de la UI.
 */
export const UIManager = {
  /**
   * Crea (o devuelve) el <video> remoto/local envuelto en una “card”.
   * @param {string} userId
   * @param {{self?:boolean,label?:string,mirror?:boolean}} opts
   * @returns {HTMLVideoElement}
   */
  createVideoElement: (userId, opts = {}) => {
    const existing = byId(`video-${userId}`);
    if (existing) return existing;

    const { video } = createVideoCard(userId, opts);
    return video;
  },

  /**
   * Adjunta un MediaStream a un video existente (con opción de espejo para local).
   * @param {string} userId
   * @param {MediaStream} stream
   * @param {{mirror?:boolean}} opts
   */
  attachStream: (userId, stream, opts = {}) => {
    const video = byId(`video-${userId}`) || UIManager.createVideoElement(userId, opts);
    if (video.srcObject !== stream) video.srcObject = stream;
    if (opts.mirror) video.classList.add('mirror'); else video.classList.remove('mirror');
    video.play?.().catch(() => {});
  },

  /**
   * Elimina el video/card de un usuario.
   */
  removeVideoElement: (userId) => {
    const card = byId(`card-${userId}`) || byId(`video-${userId}`)?.parentElement;
    if (card) card.remove();
  },

  /**
   * Marca visualmente quién está hablando (resalta borde unos ms).
   * Llama con true/false.
   */
  setSpeaking: (userId, speaking) => {
    const card = byId(`card-${userId}`);
    if (!card) return;
    card.style.boxShadow = speaking
      ? '0 0 0 2px #7ee787, 0 6px 18px rgba(0,0,0,.35)'
      : 'none';
  },

  /**
   * Cambia layout: 'auto' (grid) o 'solo' (una columna).
   */
  setLayout: (mode = 'auto') => {
    if (!videosRoot) return;
    videosRoot.style.display = 'grid';
    videosRoot.style.gap = '10px';
    if (mode === 'solo') {
      videosRoot.style.gridTemplateColumns = 'repeat(1, minmax(240px, 1fr))';
    } else {
      videosRoot.style.gridTemplateColumns = 'repeat(auto-fit, minmax(240px, 1fr))';
    }
  },

  /**
   * Actualiza el indicador de conexión (si existe en tu HTML).
   */
  updateConnectionStatus: (ok) => {
    const dot = byId('connectionDot');
    const txt = byId('connectionText');
    if (!dot || !txt) return;
    dot.classList.toggle('ok', !!ok);
    dot.classList.toggle('err', !ok);
    txt.textContent = ok ? 'Conectado' : 'Desconectado';
  },

  /**
   * Pinta panel de participantes (si existe #participants y #count).
   * Acepta Map (peerId->pc) o array de ids.
   */
  renderParticipants: (mapOrArray) => {
    const ul = byId('participants');
    const count = byId('count');
    if (!ul || !count) return;

    const ids = Array.isArray(mapOrArray)
      ? mapOrArray
      : (mapOrArray && mapOrArray.keys) ? [...mapOrArray.keys()] : [];

    ul.innerHTML = '';
    ids.forEach(id => {
      const li = document.createElement('li');
      li.textContent = id;
      ul.appendChild(li);
    });
    count.textContent = ids.length;
  }
};
