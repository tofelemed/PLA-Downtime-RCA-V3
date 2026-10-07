import { io, Socket } from 'socket.io-client';
import { SOCKET_BASE_URL } from './apiBaseUrl';
import { EventEmitter } from 'events';

export interface ConnectionStatusUpdate {
  connectionId: string;
  protocol: string;
  status: {
    status: 'connected' | 'disconnected' | 'error' | 'connecting';
    error?: string;
    timestamp?: string;
  };
  timestamp: string;
}

export interface ConnectionHealthUpdate {
  connectionId: string;
  protocol: string;
  health: {
    status: string;
    errorMessage?: string | null;
    metrics?: any;
    checkedAt: Date;
  };
  timestamp: string;
}

export interface ConnectionDataUpdate {
  connectionId: string;
  protocol: string;
  data: any;
  timestamp: string;
}

export interface ConnectionErrorUpdate {
  connectionId: string;
  protocol: string;
  error: any;
  timestamp: string;
}

export type ConnectivityEventType =
  | 'connection_status'
  | 'connection_status_changed'
  | 'connection_health'
  | 'connection_data'
  | 'connection_error'
  | 'system_notification';

export type ConnectivityEventListener<T = any> = (data: T) => void;

/**
 * WebSocket service for real-time connectivity updates
 */
export class ConnectivityWebSocketService extends EventEmitter {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000;
  private subscriptions: Map<string, Set<string>> = new Map(); // connectionId -> Set<eventType>

  constructor(private baseUrl: string = SOCKET_BASE_URL) {
    super();
  }

  /**
   * Connect to the connectivity WebSocket gateway
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected && this.socket?.connected) {
        resolve();
        return;
      }

      const wsUrl = `${this.baseUrl}/connectivity`;
      console.log('[ConnectivityWebSocket] Connecting to', wsUrl);

      this.socket = io(wsUrl, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.maxReconnectAttempts,
        timeout: 20000,
      });

      this.socket.on('connect', () => {
        console.log('[ConnectivityWebSocket] Connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
        resolve();

        // Resubscribe to all previous subscriptions
        this.resubscribeAll();
      });

      this.socket.on('disconnect', (reason) => {
        console.log('[ConnectivityWebSocket] Disconnected:', reason);
        this.isConnected = false;
        this.emit('disconnected', reason);
      });

      this.socket.on('connect_error', (error) => {
        console.error('[ConnectivityWebSocket] Connection error:', error);
        this.reconnectAttempts++;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(error);
        }
        this.emit('error', error);
      });

      this.socket.on('connected', (data: any) => {
        console.log('[ConnectivityWebSocket] Gateway welcome:', data);
      });

      // Set up event listeners
      this.setupEventListeners();

      // Handle reconnection
      this.socket.on('reconnect', (attemptNumber) => {
        console.log('[ConnectivityWebSocket] Reconnected after', attemptNumber, 'attempts');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.resubscribeAll();
        this.emit('reconnected', attemptNumber);
      });
    });
  }

  /**
   * Disconnect from the WebSocket gateway
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.subscriptions.clear();
    this.emit('disconnected');
  }

  /**
   * Subscribe to connection status updates
   */
  subscribeToConnection(connectionId: string, protocol: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      this.socket.emit(
        'subscribe_connection',
        { connectionId, protocol },
        (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
            return;
          }

          console.log('[ConnectivityWebSocket] Subscribed to connection', connectionId);
          if (!this.subscriptions.has(connectionId)) {
            this.subscriptions.set(connectionId, new Set());
          }
          this.subscriptions.get(connectionId)!.add('connection_status');
          this.subscriptions.get(connectionId)!.add('connection_data');
          this.subscriptions.get(connectionId)!.add('connection_health');
          this.subscriptions.get(connectionId)!.add('connection_error');

          resolve();
        },
      );
    });
  }

  /**
   * Unsubscribe from connection updates
   */
  unsubscribeFromConnection(connectionId: string): void {
    if (!this.socket || !this.isConnected) {
      return;
    }

    this.socket.emit('unsubscribe_connection', { connectionId });
    this.subscriptions.delete(connectionId);
    console.log('[ConnectivityWebSocket] Unsubscribed from connection', connectionId);
  }

  /**
   * Subscribe to protocol-wide updates
   */
  subscribeToProtocol(protocol: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      this.socket.emit('subscribe_protocol', { protocol }, (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }

        console.log('[ConnectivityWebSocket] Subscribed to protocol', protocol);
        resolve();
      });
    });
  }

  /**
   * Subscribe to tenant-wide updates
   */
  subscribeToTenant(tenantId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      this.socket.emit('subscribe_tenant', { tenantId }, (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }

        console.log('[ConnectivityWebSocket] Subscribed to tenant', tenantId);
        resolve();
      });
    });
  }

  /**
   * Request data from a connection
   */
  requestData(connectionId: string, nodes?: string[]): void {
    if (!this.socket || !this.isConnected) {
      console.warn('[ConnectivityWebSocket] Cannot request data: not connected');
      return;
    }

    this.socket.emit('request_data', { connectionId, nodes });
  }

  /**
   * Set up event listeners for WebSocket events
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connection_status', (data: ConnectionStatusUpdate) => {
      this.emit('connection_status', data);
    });

    this.socket.on('connection_status_changed', (data: ConnectionStatusUpdate) => {
      this.emit('connection_status_changed', data);
      this.emit('connection_status', data); // Also emit as regular status update
    });

    this.socket.on('connection_health', (data: ConnectionHealthUpdate) => {
      this.emit('connection_health', data);
    });

    this.socket.on('connection_data', (data: ConnectionDataUpdate) => {
      this.emit('connection_data', data);
    });

    this.socket.on('connection_error', (data: ConnectionErrorUpdate) => {
      this.emit('connection_error', data);
    });

    this.socket.on('system_notification', (notification: any) => {
      this.emit('system_notification', notification);
    });
  }

  /**
   * Resubscribe to all previous subscriptions after reconnection
   */
  private resubscribeAll(): void {
    // Resubscribe logic would go here
    // For now, we'll rely on components to resubscribe
    console.log('[ConnectivityWebSocket] Ready for resubscriptions');
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  /**
   * Get socket instance (for advanced usage)
   */
  getSocket(): Socket | null {
    return this.socket;
  }
}

// Singleton instance
let connectivityWebSocketInstance: ConnectivityWebSocketService | null = null;

/**
 * Get or create the connectivity WebSocket service instance
 */
export function getConnectivityWebSocketService(
  baseUrl?: string,
): ConnectivityWebSocketService {
  if (!connectivityWebSocketInstance) {
    const wsUrl = baseUrl ?? SOCKET_BASE_URL;
    connectivityWebSocketInstance = new ConnectivityWebSocketService(wsUrl);
  }
  return connectivityWebSocketInstance;
}

// Export default instance
export const connectivityWebSocket = getConnectivityWebSocketService();

