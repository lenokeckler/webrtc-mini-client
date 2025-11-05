const videoGrid = document.getElementById('videoGrid');

/**
 * Gestiona la creación y eliminación de elementos de video en la interfaz de usuario.
 */
export const UIManager = {
  createVideoElement: (userId) => {
    // tarjeta contenedora
    const card = document.createElement('div');
    card.className = 'video-card';
    card.id = `card-${userId}`;

    // etiqueta con el id
    const badge = document.createElement('div');
    badge.className = 'badge';
    badge.textContent = userId;

    // video
    const video = document.createElement('video');
    video.id = `video-${userId}`;
    video.autoplay = true;
    video.playsInline = true;
    video.style.backgroundColor = 'black';

    card.appendChild(badge);
    card.appendChild(video);
    videoGrid.appendChild(card);

    return video;
  },

  removeVideoElement: (userId) => {
    const card = document.getElementById(`card-${userId}`);
    if (card) card.remove();
  }
};
