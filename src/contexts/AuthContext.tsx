import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { authApi, AuthenticatedUser, LoginRequest, LoginResponse } from '../services/api/authApi';
import { httpClient } from '../services/api/httpClient';
import { masterDataApi, Organization, Tenant } from '../services/api/masterDataApi';
import { auditService } from '../services/AuditService';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface AuthSession {
  user: AuthenticatedUser;
  organization: Organization | null;
  tenant: Tenant | null;
  token: string;
}

interface AuthContextType {
  session: AuthSession | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  selectTenant: (tenantId: string) => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'proact_auth_state';

type StoredAuthState = {
  tokens: AuthTokens;
  user: AuthenticatedUser;
  organization?: Organization | null;
  tenant?: Tenant | null;
};

const mapTokens = (response: LoginResponse): AuthTokens => ({
  accessToken: response.access_token,
  refreshToken: response.refresh_token,
  expiresAt: Date.now() + response.expires_in * 1000,
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize tokens synchronously from localStorage BEFORE components mount
  const initializeTokensFromStorage = (): AuthTokens | null => {
    try {
      const storedStateRaw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!storedStateRaw) return null;
      
      const storedState = JSON.parse(storedStateRaw) as StoredAuthState;
      return storedState.tokens;
    } catch {
      return null;
    }
  };

  const initialTokens = initializeTokensFromStorage();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(initialTokens);
  const tokensRef = useRef<AuthTokens | null>(initialTokens);
  const [isLoading, setIsLoading] = useState(true);

  const applyTokens = (nextTokens: AuthTokens | null) => {
    tokensRef.current = nextTokens;
    setTokens(nextTokens);
    // Ensure token provider is updated whenever tokens change
    httpClient.setTokenProvider(() => tokensRef.current?.accessToken ?? null);
  };

  // Set up token provider immediately with initial tokens
  useEffect(() => {
    if (initialTokens) {
      applyTokens(initialTokens);
    }
    httpClient.setTokenProvider(() => tokensRef.current?.accessToken ?? null);
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      const storedStateRaw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!storedStateRaw) {
        setIsLoading(false);
        return;
      }

      try {
        const storedState = JSON.parse(storedStateRaw) as StoredAuthState;
        let activeTokens = storedState.tokens;

        // Tokens already applied synchronously during initialization
        // Just check if refresh is needed
        const needsRefresh = activeTokens.expiresAt <= Date.now() + 60_000;
        if (needsRefresh) {
          try {
            activeTokens = await refreshTokens(activeTokens.refreshToken);
          } catch (refreshError) {
            console.warn('Token refresh failed, using stored token', refreshError);
            // Don't clear session if refresh fails - let user continue with current token
            // Only clear if token is truly invalid (will happen on next API call)
          }
        }

        // Try to build session, but don't fail completely if API calls fail
        try {
          const rebuiltSession = await buildSession(storedState.user, activeTokens, {
            organizationFallback: storedState.organization ?? null,
            tenantFallback: storedState.tenant ?? null,
          });

          setSession(rebuiltSession);
          persistAuthState(rebuiltSession, activeTokens);
        } catch (buildError) {
          // If buildSession fails (e.g., 401 on org/tenant fetch), create session with fallback data
          console.warn('buildSession failed, using fallback data', buildError);
          const fallbackSession: AuthSession = {
            user: storedState.user,
            organization: storedState.organization ?? null,
            tenant: storedState.tenant ?? null,
            token: activeTokens.accessToken,
          };
          setSession(fallbackSession);
          // Don't persist - let it work with current token and try to refresh org/tenant later
        }
      } catch (error) {
        console.error('Failed to restore authentication state', error);
        // Only clear if token parsing failed or something critical
        if (error instanceof SyntaxError || error instanceof TypeError) {
          clearAuthState();
        }
        // Otherwise, keep session null but don't clear localStorage - might be recoverable
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const persistAuthState = (currentSession: AuthSession, currentTokens: AuthTokens) => {
    const payload: StoredAuthState = {
      tokens: currentTokens,
      user: currentSession.user,
      organization: currentSession.organization,
      tenant: currentSession.tenant,
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
  };

  const clearAuthState = () => {
    applyTokens(null);
    setSession(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const refreshTokens = async (refreshToken: string) => {
    const response = await authApi.refreshToken(refreshToken);
    const nextTokens = mapTokens(response);
    applyTokens(nextTokens);
    return nextTokens;
  };

  const buildSession = async (
    user: AuthenticatedUser,
    activeTokens: AuthTokens,
    options?: {
      organizationFallback?: Organization | null;
      tenantFallback?: Tenant | null;
    },
  ): Promise<AuthSession> => {
    applyTokens(activeTokens);

    let organization: Organization | null = options?.organizationFallback ?? null;
    if (user.organizationId) {
      try {
        organization = await masterDataApi.getOrganization(user.organizationId);
      } catch (error) {
        console.warn('Unable to load organization details', error);
      }
    }

    let tenant: Tenant | null = options?.tenantFallback ?? null;
    if (user.tenantId) {
      try {
        tenant = await masterDataApi.getTenant(user.tenantId);
      } catch (error) {
        console.warn('Unable to load tenant details', error);
      }
    }

    return {
      user,
      organization,
      tenant,
      token: activeTokens.accessToken,
    };
  };

  const login = async (email: string, password: string) => {
    try {
      // Clear any existing auth state before login to prevent token conflicts
      clearAuthState();
      
      const payload: LoginRequest = { email, password };
      const response = await authApi.login(payload);
      const nextTokens = mapTokens(response);

      // Apply tokens FIRST so they're available for API calls in buildSession
      applyTokens(nextTokens);
      
      // Verify token is set and log for debugging
      const currentToken = tokensRef.current?.accessToken;
      if (!currentToken) {
        console.error('[AuthContext] ❌ Token was not set after applyTokens');
        throw new Error('Failed to set authentication token');
      }
      
      console.log('[AuthContext] ✅ Token set successfully, length:', currentToken.length);
      
      const nextSession = await buildSession(response.user, nextTokens);
      setSession(nextSession);
      persistAuthState(nextSession, nextTokens);

      auditService.logLogin(
        response.user.id,
        response.user.name,
        nextSession.organization?.id || nextSession.tenant?.organizationId || '',
        nextSession.tenant?.id || response.user.tenantId || '',
      ).catch(() => {});

      console.log('[AuthContext] ✅ Login completed successfully');
      return true;
    } catch (error) {
      console.error('[AuthContext] ❌ Login failed:', error);
      clearAuthState();
      return false;
    }
  };

  const logout = async () => {
    const current = session;
    try {
      await authApi.logout();
    } catch (error) {
      console.warn('Failed to notify backend about logout', error);
    } finally {
      if (current?.user) {
        auditService.logLogout(
          current.user.id,
          current.user.name,
          current.organization?.id || current.tenant?.organizationId || '',
          current.tenant?.id || current.user.tenantId || '',
        ).catch(() => {});
      }
      clearAuthState();
    }
  };

  const selectTenant = async (tenantId: string) => {
    if (!session) return;
    try {
      const tenant = await masterDataApi.getTenant(tenantId);
      const updatedSession: AuthSession = {
      ...session,
      tenant,
    };
    setSession(updatedSession);
      if (tokensRef.current) {
        persistAuthState(updatedSession, tokensRef.current);
      }
    } catch (error) {
      console.error('Failed to select tenant', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
      session,
      login,
      logout,
      selectTenant,
      isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

