import { io, Socket } from 'socket.io-client';
import { v2Session } from '@/api/v2/config';
import { createLogger } from '@/lib/logger';
import { SOCKET_BASE_URL } from './apiBaseUrl';

type ProductionEventListener = (event: unknown) => void;

const log = createLogger('ProductionEventsWS');
const EVENT_NAMES = ['productionEventCreated', 'productionEventUpdated', 'productionEventDeleted'];

/**
 * v1 production-event pushes on the `/socket.io` namespace (flag-off Event Hub, decision C4).
 * Plan 3.11: the server admits only authenticated sockets and sends each event to its tenant only, so
 * the handshake carries the current access token and acting tenant (read at every (re)connect, so a
 * refreshed token is used after the server disconnects an expired one). A tenant change reconnects.
 */
class ProductionEventsWebSocketService {
  private socket: Socket | null = null;
  private tenantId: string | null = null;
  private listeners: Map<string, Set<ProductionEventListener>> = new Map();
  private connected = false;

  connect(baseUrl?: string): void {
    const tenantId = v2Session().getTenantId();
    if (this.socket && this.tenantId === tenantId) return;
    this.disconnect();
    this.tenantId = tenantId;

    const url = baseUrl ?? SOCKET_BASE_URL;
    this.socket = io(`${url}/socket.io`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      auth: (callback) => {
        const session = v2Session();
        callback({ token: session.getAccessToken() ?? '', tenantId: session.getTenantId() ?? undefined });
      },
    });

    this.socket.on('connect', () => {
      this.connected = true;
    });
    this.socket.on('disconnect', () => {
      this.connected = false;
    });
    this.socket.on('connect_error', (error: Error) => log.warn('Connection refused', error?.message));

    for (const eventName of EVENT_NAMES) {
      this.socket.on(eventName, (payload: unknown) => {
        this.emit(eventName, payload);
      });
    }
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.tenantId = null;
    this.connected = false;
  }

  on(eventName: string, listener: ProductionEventListener): () => void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName)!.add(listener);
    return () => this.listeners.get(eventName)?.delete(listener);
  }

  private emit(eventName: string, payload: unknown) {
    this.listeners.get(eventName)?.forEach((listener) => listener(payload));
  }

  isConnected(): boolean {
    return this.connected;
  }
}

export const productionEventsWebSocket = new ProductionEventsWebSocketService();
