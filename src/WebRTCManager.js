/**
 * Gestiona toda la lógica de WebRTC: creación de conexiones, ofertas, respuestas y candidatos ICE.
 * Su responsabilidad es manejar el protocolo de señalización de WebRTC.
 */
export class WebRTCManager {
    constructor(peerManager, uiManager, webSocketManager) {
        this.peerManager = peerManager;
        this.uiManager = uiManager;
        this.wsManager = webSocketManager;
        this.iceCandidateQueue = new Map();
        this.myUserId = null;
        this.localStream = null;
    }

    setMyUserId(userId) {
        this.myUserId = userId;
    }

    setLocalStream(stream) {
        this.localStream = stream;
        console.log('WebRTCManager ha recibido el stream local.');
    }

    /**
     * Obtiene una conexión existente o crea una nueva junto con su elemento de video.
     * Esto centraliza la creación y evita duplicados.
     * @param {string} userId - El ID del usuario par.
     * @returns {{peerConnection: RTCPeerConnection, videoElement: HTMLVideoElement}}
     */
    getOrCreatePeerConnection(userId) {
        let peerConnection = this.peerManager.peerConnections.get(userId);
        if (!peerConnection) {
            const videoElement = this.uiManager.createVideoElement(userId);
            peerConnection = this.peerManager.createPeerConnection(userId);
            this.setupPeerConnectionHandlers(peerConnection, userId, videoElement);
            return { peerConnection, videoElement };
        }
        return { peerConnection, videoElement: document.getElementById(`video-${userId}`) };
    }

    /**
     * Inicia la conexión con un nuevo usuario (flujo del "iniciador").
     */
    async handleUserJoined(userId) {
        // Para prevenir una condición de carrera (glare), solo el par con el ID "menor" (alfabéticamente) iniciará la conexión.
        if (this.myUserId > userId) {
            console.log(`Mi ID (${this.myUserId}) es mayor que ${userId}. Esperaré su oferta.`);
            return;
        }
        console.log(`Mi ID (${this.myUserId}) es menor que ${userId}. Inciaré la conexión.`);

        const { peerConnection } = this.getOrCreatePeerConnection(userId);

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, this.localStream);
            });
        }

        // --- Inicio del proceso de negociación SDP (Session Description Protocol) ---

        // 1. Crear una "oferta". Este es un objeto SDP que describe la configuración de medios de este cliente
        // (qué codecs de audio/video soporta, cómo quiere recibir datos, etc.).
        const offer = await peerConnection.createOffer();

        // 2. Establecer la descripción local. Esto le dice a nuestra propia RTCPeerConnection qué es lo que acabamos de ofrecer.
        // La conexión entra en el estado 'have-local-offer'.
        await peerConnection.setLocalDescription(offer);

        // 3. Enviar la oferta al otro par a través del servidor de señalización (WebSocket).
        // El otro par usará esta oferta para crear una "respuesta".
        this.wsManager.send({ type: 'offer', userId: userId, offer: offer });
        console.log(`Oferta enviada a ${userId}`);
    }

    /**
     * Maneja una oferta entrante (flujo del "receptor").
     */
    async handleOffer(userId, offer) {
        // --- Inicio del proceso de respuesta a una oferta ---

        // 1. Obtener o crear la conexión para este par.
        const { peerConnection } = this.getOrCreatePeerConnection(userId);

        // 2. Añadir nuestras pistas de audio/video a la conexión para que el otro par pueda recibirlas.
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, this.localStream);
            });
        }

        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

        // 4. Crear una "respuesta" (answer). Este es nuestro propio SDP que responde a la oferta,
        // confirmando los parámetros de la sesión.
        const answer = await peerConnection.createAnswer();

        // 5. Establecer la respuesta como nuestra descripción local.
        await peerConnection.setLocalDescription(answer);

        // 6. Procesar cualquier candidato ICE que haya llegado antes de tiempo.
        await this.processIceCandidateQueue(userId, peerConnection);

        // 7. Enviar nuestra respuesta al par que nos hizo la oferta.
        this.wsManager.send({ type: 'answer', userId: userId, answer: answer });
        console.log(`Respuesta enviada a ${userId}`);
    }

    /**
     * Maneja una respuesta a una oferta que enviamos previamente.
     * @param {string} userId - El ID del usuario que responde.
     * @param {RTCSessionDescriptionInit} answer - El objeto de respuesta SDP.
     */
    async handleAnswer(userId, answer) {
        const peerConnection = this.peerManager.peerConnections.get(userId);
        // Verificar que la conexión existe y está esperando una respuesta.
        if (!peerConnection || peerConnection.signalingState !== 'have-local-offer') {
            console.error(`Respuesta recibida de ${userId}, pero la conexión no está en el estado correcto.`);
            return;
        }
        // Establecer la respuesta del par remoto como la descripción remota.
        // ¡En este punto, la negociación SDP está completa! Ambos pares saben cómo comunicarse.
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log(`Respuesta de ${userId} aceptada.`);

        // Ahora que la negociación terminó, procesar cualquier candidato ICE que estuviera en cola.
        await this.processIceCandidateQueue(userId, peerConnection);
    }

    /**
     * Maneja un candidato ICE entrante.
     * @param {string} userId - El ID del usuario que envía el candidato.
     * @param {RTCIceCandidateInit} candidate - El objeto del candidato ICE.
     */
    async handleIceCandidate(userId, candidate) {
        const peerConnection = this.peerManager.peerConnections.get(userId);

        // Si la descripción remota aún no está establecida, no podemos añadir candidatos ICE.
        // Los encolamos para procesarlos más tarde, una vez que la negociación SDP haya avanzado.
        if (!peerConnection || !peerConnection.remoteDescription || peerConnection.remoteDescription.type === '') {
            console.log(`Encolando candidato ICE de ${userId} porque la descripción remota aún no está lista.`);
            if (!this.iceCandidateQueue.has(userId)) {
                this.iceCandidateQueue.set(userId, []);
            }
            this.iceCandidateQueue.get(userId).push(candidate);
            return;
        }

        // Si la conexión está lista, añadir el candidato ICE para que pueda ser probado.
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
            console.error(`Error al añadir el candidato ICE recibido de ${userId}:`, e);
        }
    }

    /**
     * Limpia los recursos asociados a un usuario que se ha desconectado.
     */
    handleUserLeft(userId) {
        this.peerManager.removePeerConnection(userId);
        this.iceCandidateQueue.delete(userId);
        this.uiManager.removeVideoElement(userId);
        console.log(`Usuario ${userId} se ha desconectado. Conexión cerrada.`);
    }

    /**
     * Configura los manejadores de eventos esenciales para una RTCPeerConnection.
     * @param {RTCPeerConnection} peerConnection - La instancia de la conexión.
     * @param {string} userId - El ID del usuario remoto.
     * @param {HTMLVideoElement} videoElement - El elemento de video donde se mostrará el stream remoto.
     */
    setupPeerConnectionHandlers(peerConnection, userId, videoElement) {
        // Evento 'ontrack': Se dispara cuando se recibe una pista de medios (audio o video) del par remoto.
        // Esta es la parte mágica donde recibimos el video de la otra persona.
        peerConnection.ontrack = (event) => {
            console.log(`Recibiendo stream de ${userId}`);
            if (videoElement.srcObject !== event.streams[0]) {
                videoElement.srcObject = event.streams[0];
                // Forzar la reproducción para asegurar que el video comience.
                videoElement.play().catch(e => {
                    console.error(`Error al intentar reproducir el video de ${userId}:`, e);
                });
            }
        };

        // Evento 'onicecandidate': Se dispara cuando el agente ICE local encuentra un nuevo candidato de red.
        // Debemos enviar este candidato al par remoto a través de nuestro servidor de señalización.
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.wsManager.send({ type: 'ice-candidate', userId: userId, candidate: event.candidate });
            }
        };
    }

    /**
     * Procesa los candidatos ICE que fueron recibidos antes de que la conexión estuviera lista para aceptarlos.
     * @param {string} userId - El ID del usuario par.
     * @param {RTCPeerConnection} peerConnection - La instancia de la conexión.
     */
    async processIceCandidateQueue(userId, peerConnection) {
        if (this.iceCandidateQueue.has(userId)) {
            const candidates = this.iceCandidateQueue.get(userId);
            console.log(`Procesando ${candidates.length} candidatos ICE encolados para ${userId}.`);
            for (const candidate of candidates) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }
            this.iceCandidateQueue.delete(userId);
        }
    }
}