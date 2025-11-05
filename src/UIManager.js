const videoGrid = document.getElementById('videoGrid');

/**
 * Gestiona la creación y eliminación de elementos de video en la interfaz de usuario.
 */
export const UIManager = {
    createVideoElement: (userId) => {
        const videoElement = document.createElement('video');
        videoElement.id = `video-${userId}`;
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.style.backgroundColor = 'black'; // Ayuda a visualizar el contenedor antes de que llegue el stream
        videoGrid.appendChild(videoElement);
        return videoElement;
    },
    removeVideoElement: (userId) => {
        const videoElement = document.getElementById(`video-${userId}`);
        if (videoElement) {
            videoElement.remove();
        }
    }
};