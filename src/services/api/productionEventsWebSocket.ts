import { io, Socket } from 'socket.io-client';
import { SOCKET_BASE_URL } from './apiBaseUrl';

type ProductionEventListener = (event: any) => void;

class ProductionEventsWebSocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<ProductionEventListener>> = new Map();
  private connected = false;

  connect(baseUrl?: string): void {
    if (this.socket?.connected) return;

    const url = baseUrl ?? SOCKET_BASE_URL;

    this.socket = io(`${url}/socket.io`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      this.connected = true;
      console.log('[ProductionEventsWS] Connected');
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      console.log('[ProductionEventsWS] Disconnected');
    });

    const eventNames = [
      'productionEventCreated',
      'productionEventUpdated',
      'productionEventDeleted',
    ];

    for (const eventName of eventNames) {
      this.socket.on(eventName, (payload: any) => {
        this.emit(eventName, payload);
      });
    }
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.connected = false;
  }

  on(eventName: string, listener: ProductionEventListener): () => void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName)!.add(listener);
    return () => this.listeners.get(eventName)?.delete(listener);
  }

  private emit(eventName: string, payload: any) {
    this.listeners.get(eventName)?.forEach((listener) => listener(payload));
  }

  isConnected(): boolean {
    return this.connected;
  }
}

export const productionEventsWebSocket = new ProductionEventsWebSocketService();
