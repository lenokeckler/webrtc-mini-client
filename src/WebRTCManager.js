/**
 * Gestiona WebRTC (ofertas, respuestas, candidatos ICE) + utilidades de UX:
 * mute/unmute, cam on/off, compartir pantalla y cierre limpio.
 */
export class WebRTCManager {
  constructor(peerManager, uiManager, webSocketManager) {
    this.peerManager = peerManager;
    this.uiManager = uiManager;
    this.wsManager = webSocketManager;

    this.iceCandidateQueue = new Map();
    this.myUserId = null;
    this.localStream = null;
    this._screenTrack = null;  // para compartir pantalla
  }

  // ===== utilidades nuevas =====
  getLocalStream() { return this.localStream; }

  toggleMic() {
    const t = this.localStream?.getAudioTracks?.()[0];
    if (!t) return null;
    t.enabled = !t.enabled;
    return !t.enabled; // true = silenciado
  }

  toggleCam() {
    const t = this.localStream?.getVideoTracks?.()[0];
    if (!t) return null;
    t.enabled = !t.enabled;
    return !t.enabled; // true = cámara apagada
  }

  async startScreenShare() {
    if (this._screenTrack) return true; // ya compartiendo
    const ds = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const track = ds.getVideoTracks()[0];

    // Reemplaza pista de video en cada RTCPeerConnection
    this.peerManager.peerConnections?.forEach?.((pc) => {
      const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) sender.replaceTrack(track);
    });

    // Previsualización local (opcional): usa el track de pantalla
    if (this.localStream) {
      const audios = this.localStream.getAudioTracks();
      const preview = new MediaStream([ ...(audios || []), track ]);
      const localVideo = document.querySelector('#videos video[data-self="1"]');
      if (localVideo) localVideo.srcObject = preview;
    }

    this._screenTrack = track;
    track.onended = () => this.stopScreenShare();
    return true;
  }

  stopScreenShare() {
    if (!this._screenTrack) return false;
    const cam = this.localStream?.getVideoTracks?.()[0];

    this.peerManager.peerConnections?.forEach?.((pc) => {
      const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender && cam) sender.replaceTrack(cam);
    });

    this._screenTrack.stop();
    this._screenTrack = null;

    // Restaurar preview local a la cámara
    const localVideo = document.querySelector('#videos video[data-self="1"]');
    if (localVideo && this.localStream) localVideo.srcObject = this.localStream;
    return true;
  }

  closeAll() {
    try {
      this.peerManager.peerConnections?.forEach?.((pc, uid) => {
        try { pc.close(); } catch {}
        this.uiManager?.removeVideoElement?.(uid);
      });
      this.peerManager.peerConnections = new Map();
      this.iceCandidateQueue.clear();
      this.localStream?.getTracks?.().forEach(t => t.stop());
      this._screenTrack?.stop?.();
    } catch {}
  }

  // ===== setters existentes =====
  setMyUserId(userId) {
    this.myUserId = userId;
  }

  setLocalStream(stream) {
    this.localStream = stream;
    console.log('WebRTCManager ha recibido el stream local.');
  }

  // ===== conexión =====
  /**
   * Obtiene o crea RTCPeerConnection + <video> remoto.
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

  /** Iniciador (glare-avoid: sólo si mi ID < su ID) */
  async handleUserJoined(userId) {
    if (this.myUserId > userId) {
      console.log(`Mi ID (${this.myUserId}) es mayor que ${userId}. Espero su oferta.`);
      return;
    }
    console.log(`Mi ID (${this.myUserId}) es menor que ${userId}. Inicio la conexión.`);

    const { peerConnection } = this.getOrCreatePeerConnection(userId);

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, this.localStream);
      });
    }

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    this.wsManager.send({ type: 'offer', userId, offer });
    console.log(`Oferta enviada a ${userId}`);
  }

  /** Receptor de oferta */
  async handleOffer(userId, offer) {
    const { peerConnection } = this.getOrCreatePeerConnection(userId);

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, this.localStream);
      });
    }

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    await this.processIceCandidateQueue(userId, peerConnection);

    this.wsManager.send({ type: 'answer', userId, answer });
    console.log(`Respuesta enviada a ${userId}`);
  }

  /** Llega respuesta a mi oferta */
  async handleAnswer(userId, answer) {
    const pc = this.peerManager.peerConnections.get(userId);
    if (!pc || pc.signalingState !== 'have-local-offer') {
      console.error(`Respuesta de ${userId} fuera de estado.`);
      return;
    }
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
    console.log(`Respuesta de ${userId} aceptada.`);
    await this.processIceCandidateQueue(userId, pc);
  }

  /** Candidato ICE entrante */
  async handleIceCandidate(userId, candidate) {
    const pc = this.peerManager.peerConnections.get(userId);

    if (!pc || !pc.remoteDescription || pc.remoteDescription.type === '') {
      console.log(`Encolando ICE de ${userId} (remoteDescription no lista).`);
      if (!this.iceCandidateQueue.has(userId)) this.iceCandidateQueue.set(userId, []);
      this.iceCandidateQueue.get(userId).push(candidate);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error(`Error al añadir ICE de ${userId}:`, e);
    }
  }

  /** Limpia al salir un usuario */
  handleUserLeft(userId) {
    this.peerManager.removePeerConnection(userId);
    this.iceCandidateQueue.delete(userId);
    this.uiManager.removeVideoElement(userId);
    console.log(`Usuario ${userId} salió. Conexión cerrada.`);
    this.uiManager?.renderParticipants?.(this.peerManager?.peerConnections || []);
  }

  /**
   * Handlers de RTCPeerConnection (track/ICE/estados/renegociación)
   */
  setupPeerConnectionHandlers(peerConnection, userId, videoElement) {
    // Pista remota
    peerConnection.ontrack = (event) => {
      console.log(`Recibiendo stream de ${userId}`);
      if (videoElement.srcObject !== event.streams[0]) {
        videoElement.srcObject = event.streams[0];
        videoElement.play().catch(e => {
          console.error(`No pudo reproducir video de ${userId}:`, e);
        });
      }
    };

    // Candidatos locales
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.wsManager.send({ type: 'ice-candidate', userId, candidate: event.candidate });
      }
    };

    // Estado de conexión (para pintar dot/estado)
    peerConnection.onconnectionstatechange = () => {
      const st = peerConnection.connectionState; // 'connected','failed','disconnected',...
      this.uiManager?.updateConnectionStatus?.(st === 'connected');
      if (st === 'failed' || st === 'closed') {
        // limpieza defensiva
        this.peerManager.removePeerConnection(userId);
        this.uiManager.removeVideoElement(userId);
      }
    };

    // (Opcional) renegociación si cambia video (p.ej., al compartir pantalla)
    peerConnection.onnegotiationneeded = async () => {
      try {
        // Evita glare: solo el lado “menor” inicia
        if (this.myUserId <= userId) {
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          this.wsManager.send({ type: 'offer', userId, offer });
          console.log(`Renegociación: oferta enviada a ${userId}`);
        } else {
          console.log(`Renegociación: espero oferta de ${userId}`);
        }
      } catch (e) {
        console.warn('onnegotiationneeded error:', e);
      }
    };
  }

  /** Aplica candidatos encolados */
  async processIceCandidateQueue(userId, peerConnection) {
    if (this.iceCandidateQueue.has(userId)) {
      const candidates = this.iceCandidateQueue.get(userId);
      console.log(`Procesando ${candidates.length} ICE encolados para ${userId}.`);
      for (const c of candidates) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(c));
      }
      this.iceCandidateQueue.delete(userId);
    }
  }
}
