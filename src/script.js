import { VideoConferenceApp } from './VideoConferenceApp.js';

// --- Elementos del DOM y Variables Globales ---
const localVideo = document.getElementById('localVideo');

// --- Inicialización de la Aplicación ---
async function main() {
    try {
        const app = new VideoConferenceApp(localVideo);
        await app.start();
    } catch (error) {
        console.error('Fallo al iniciar la aplicación:', error);
    }
}

main().catch(console.error);
