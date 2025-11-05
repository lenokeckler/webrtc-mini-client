export class PeerConnectionManager {
    constructor() {
        this.peerConnections = new Map(); // Map of userId -> RTCPeerConnection
        this.localStream = null;
        this.rtcManager = null;
    }

    setRtcManager(rtcManager) {
        this.rtcManager = rtcManager;
    }

    async setupLocalStream() {
        this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (this.rtcManager) this.rtcManager.setLocalStream(this.localStream);
        return this.localStream;
    }

    createPeerConnection(userId) {
        const peerConnection = new RTCPeerConnection();
        this.peerConnections.set(userId, peerConnection);
        return peerConnection;
    }

    removePeerConnection(userId) {
        const connection = this.peerConnections.get(userId);
        if (connection) {
            connection.close();
            this.peerConnections.delete(userId);
        }
    }
}