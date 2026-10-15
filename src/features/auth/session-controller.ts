import { authApi } from '@/services/api/authApi';
import { createLogger } from '@/lib/logger';
import {
  AUTH_STORAGE_KEY, boundedSessionRequest, isUnauthorized, mapTokens,
  readSessionDetails, readSessionProfile, readStoredAuth,
  type AuthSession, type StoredAuthState,
} from './session-requests';
import { v2Request } from '@/api/v2/client';
import type { DirectoryPlant } from '@/api/v2/types/plant-directory';
import { sessionAuthorityKey } from './session-authority-key';
import { maySelectTenant } from './effective-roles';

const log = createLogger('AuthSession');
const UNAVAILABLE = 'The sign-in service is temporarily unavailable. Please try again.';
const STARTUP_UNAVAILABLE = 'We could not load your session. Your sign-in is saved. Retry when the connection is available, or sign out.';
interface SessionState {
  session: AuthSession | null;
  isLoading: boolean;
  startupError: string | null;
  loginError: string | null;
}

/** Owns credentials and asynchronous attempts; only the current attempt may publish a session. */
export class SessionController {
  private stored = readStoredAuth();
  private state: SessionState = { session: null, isLoading: true, startupError: null, loginError: null };
  private listeners = new Set<() => void>();
  private generation = 0;
  private pending = new AbortController();
  private refreshInFlight: Promise<boolean> | null = null;
  private tenantSelection = 0;

  getSnapshot = () => this.state;
  getAccessToken = () => this.stored?.tokens.accessToken ?? null;
  getSessionKey = () => `${this.generation}:${this.stored ? sessionAuthorityKey(this.stored.user) : ''}`;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  private update(next: Partial<SessionState>) {
    this.state = { ...this.state, ...next };
    this.listeners.forEach((listener) => listener());
  }

  cancelPending = () => {
    this.generation += 1;
    this.pending.abort();
    this.pending = new AbortController();
    this.refreshInFlight = null;
  };

  private persist(state: StoredAuthState) {
    this.stored = state;
    try { localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state)); }
    catch { log.warn('Browser storage unavailable; session will require sign-in after reload'); }
  }

  private clear() {
    this.cancelPending();
    this.stored = null;
    try { localStorage.removeItem(AUTH_STORAGE_KEY); }
    catch { log.warn('Browser storage could not be cleared'); }
    this.update({ session: null, isLoading: false, startupError: null });
  }

  expireSession = () => {
    this.clear();
    this.update({ loginError: 'Your session has expired. Please sign in again.' });
  };

  private failure(error: unknown, attempt: number, authenticated: boolean) {
    if (attempt !== this.generation) return;
    if (isUnauthorized(error)) {
      this.expireSession();
      return;
    }
    log.warn('Session request did not complete; retry is available');
    this.update(authenticated
      ? { session: null, isLoading: false, startupError: STARTUP_UNAVAILABLE }
      : { isLoading: false, loginError: UNAVAILABLE });
  }

  private publish(session: AuthSession, attempt: number, signal: AbortSignal) {
    signal.throwIfAborted();
    if (attempt !== this.generation || !this.stored) return;
    this.persist({ ...this.stored, user: session.user });
    this.update({ session: { ...session, token: this.stored.tokens.accessToken }, isLoading: false, startupError: null });
  }

  restoreSession = async () => {
    this.cancelPending();
    const attempt = this.generation;
    this.update({ session: null, isLoading: true, startupError: null, loginError: null });
    if (!this.stored) { this.update({ isLoading: false }); return; }
    try {
      await boundedSessionRequest(async (signal) => {
        if (this.stored!.tokens.expiresAt <= Date.now() + 60_000 && !(await this.refreshSession())) return;
        signal.throwIfAborted();
        let user;
        try { user = await readSessionProfile(this.stored!.user, signal); }
        catch (error) {
          if (!isUnauthorized(error) || !(await this.refreshSession())) throw error;
          signal.throwIfAborted();
          user = await readSessionProfile(this.stored!.user, signal);
        }
        signal.throwIfAborted();
        const details = await readSessionDetails({ ...this.stored!, user }, signal);
        this.publish(details, attempt, signal);
      }, this.pending.signal);
    } catch (error) { this.failure(error, attempt, true); }
  };

  login = async (email: string, password: string): Promise<boolean> => {
    this.clear();
    const attempt = this.generation;
    this.update({ loginError: null });
    try {
      return await boundedSessionRequest(async (signal) => {
        const response = await authApi.login({ email, password }, signal);
        signal.throwIfAborted();
        if (attempt !== this.generation) return false;
        this.persist({ user: response.user, tokens: mapTokens(response) });
        const details = await readSessionDetails(this.stored!, signal);
        this.publish(details, attempt, signal);
        return attempt === this.generation;
      }, this.pending.signal);
    } catch (error) {
      if (attempt === this.generation && isUnauthorized(error) && !this.stored) {
        this.update({ loginError: 'Sign-in failed. Check your credentials and try again.' });
      } else this.failure(error, attempt, this.stored !== null);
      return false;
    }
  };

  /** False means invalid credentials; infrastructure failures reject without discarding them. */
  refreshSession = (): Promise<boolean> => {
    if (!this.stored) return Promise.resolve(false);
    if (this.refreshInFlight) return this.refreshInFlight;
    const attempt = this.generation;
    const refreshToken = this.stored.tokens.refreshToken;
    const promise = boundedSessionRequest(async (signal) => {
      const response = await authApi.refreshToken(refreshToken, signal);
      signal.throwIfAborted();
      if (attempt !== this.generation) throw new DOMException('Session changed', 'AbortError');
      if (response.user.id !== this.stored?.user.id) throw new Error('Refresh identity changed');
      this.persist({ user: response.user, tokens: mapTokens(response) });
      const current = this.state.session;
      if (current?.tenant && !maySelectTenant(response.user, current.tenant)) {
        this.update({ session: null, startupError: 'Your plant access changed. Retry to load your current session, or sign out.' });
      } else if (current) this.update({ session: { ...current, user: response.user, token: response.access_token } });
      return true;
    }, this.pending.signal).catch((error: unknown) => {
      if (attempt === this.generation && isUnauthorized(error)) { this.expireSession(); return false; }
      throw error;
    }).finally(() => { if (this.refreshInFlight === promise) this.refreshInFlight = null; });
    this.refreshInFlight = promise;
    return promise;
  };

  logout = async () => {
    const refreshToken = this.stored?.tokens.refreshToken;
    this.clear();
    this.update({ loginError: null });
    try { await boundedSessionRequest((signal) => authApi.logout(refreshToken, signal)); }
    catch { log.warn('Local sign-out completed; server revocation could not be confirmed'); }
  };

  selectTenant = async (tenantId: string) => {
    if (!this.state.session) return;
    const attempt = this.getSessionKey();
    const selection = ++this.tenantSelection;
    await boundedSessionRequest(async (signal) => {
      const tenant = await v2Request<DirectoryPlant>({ method: 'GET', path: `/tenants/${tenantId}`, tenantId, signal });
      signal.throwIfAborted();
      if (attempt === this.getSessionKey() && selection === this.tenantSelection && this.state.session) {
        this.update({ session: { ...this.state.session, tenant: tenant.data } });
      }
    }, this.pending.signal);
  };
}
