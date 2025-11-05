/**
 * Gestiona la conexión y la comunicación con el servidor WebSocket.
 */
export class WebSocketManager {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.messageHandlers = new Map();
        this.onOpen = null;
        this.isReady = false;
        this.messageQueue = [];
    }

    /**
     * Inicializa los manejadores de eventos del WebSocket y establece la conexión.
     */
    connect() {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log('Conexión WebSocket establecida.');
            this.isReady = true;
            if (this.onOpen) {
                this.onOpen();
            }
            this.flushMessageQueue();
        };

        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (this.messageHandlers.has(message.type)) {
                this.messageHandlers.get(message.type)(message);
            } else {
                console.log('Tipo de mensaje desconocido recibido:', message.type);
            }
        };

        this.ws.onclose = () => {
            console.log('Conexión WebSocket cerrada.');
            this.isReady = false;
        };

        this.ws.onerror = (error) => {
            console.error('Error en WebSocket:', error);
        };
    }

    /**
     * Registra un callback para un tipo de mensaje específico.
     * @param {string} messageType - El tipo de mensaje (ej. 'user-joined').
     * @param {function} handler - La función que manejará el mensaje.
     */
    onMessage(messageType, handler) {
        this.messageHandlers.set(messageType, handler);
    }

    send(message) {
        if (this.isReady) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.log('WebSocket no está listo, encolando mensaje:', message);
            this.messageQueue.push(message);
        }
    }

    flushMessageQueue() {
        console.log(`Procesando ${this.messageQueue.length} mensajes encolados.`);
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.send(message);
        }
    }
}