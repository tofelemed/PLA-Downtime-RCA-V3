/**
 * Where the frontend reaches the backend.
 *
 * Resolution order:
 *  1. `window.__PROACT_API_BASE_URL__` — runtime override a host page can set.
 *  2. `VITE_API_BASE_URL` — baked in at build time. The Docker image sets it to "/api",
 *     meaning "same origin": nginx in front of the app proxies /api, /uploads and /socket.io
 *     to the backend container.
 *  3. The local development backend.
 */
const DEFAULT_API_BASE_URL = 'http://localhost:4004/api';

export const API_BASE_URL: string = (
  (typeof window !== 'undefined' &&
    (window as Window & { __PROACT_API_BASE_URL__?: string }).__PROACT_API_BASE_URL__) ||
  import.meta.env.VITE_API_BASE_URL ||
  DEFAULT_API_BASE_URL
).replace(/\/+$/, '');

/**
 * Socket.IO connects to the server root (the gateways use the "/socket.io" and "/connectivity"
 * namespaces), so drop the trailing "/api". An empty string means "current origin", which
 * socket.io-client resolves against window.location.
 */
export const SOCKET_BASE_URL: string = API_BASE_URL.replace(/\/api$/, '');
