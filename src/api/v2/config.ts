import { API_BASE_URL } from '@/services/api/apiBaseUrl';

/**
 * Session hooks of the v2 client, registered once by `V2SessionBridge`. The client reads the token at
 * call time and never stores, logs or sends it anywhere but the configured API base.
 */
export interface V2Session {
  getAccessToken(): string | null;
  /** acting tenant: `plantSelection?.tenant?.id || session?.tenant?.id` */
  getTenantId(): string | null;
  /** Changes on login, logout or a new bootstrap attempt; stable across token refresh. */
  getSessionKey?(): string;
  /** renews the access token; resolves false when the refresh token is no longer valid */
  refresh(): Promise<boolean>;
  /** called when a 401 survives a refresh: clear caches and return to the login screen */
  onSessionExpired(): void;
}

const noSession: V2Session = {
  getAccessToken: () => null,
  getTenantId: () => null,
  refresh: async () => false,
  onSessionExpired: () => undefined,
};

let session: V2Session = noSession;

/** Installs the session hooks; the returned function uninstalls them (if still current). */
export function configureV2Session(next: V2Session): () => void {
  session = next;
  return () => {
    if (session === next) session = noSession;
  };
}

export function v2Session(): V2Session {
  return session;
}

/** API base from `VITE_API_BASE_URL` / runtime override (apiBaseUrl.ts); v2 lives under `<base>/v2`. */
export function v2BaseUrl(): string {
  return `${API_BASE_URL}/v2`;
}
