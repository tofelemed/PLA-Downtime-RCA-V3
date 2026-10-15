import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { httpClient } from '@/services/api/httpClient';
import { SessionController } from '@/features/auth/session-controller';

type AuthContextType = ReturnType<SessionController['getSnapshot']> & Pick<SessionController,
  'login' | 'logout' | 'selectTenant' | 'getAccessToken' | 'getSessionKey' | 'refreshSession' | 'expireSession' | 'restoreSession'>;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(() => new SessionController());
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useEffect(() => {
    httpClient.setTokenProvider(controller.getAccessToken);
    httpClient.setSessionKeyProvider(controller.getSessionKey);
    httpClient.setRefreshHandler(controller.refreshSession);
    void controller.restoreSession();
    return () => {
      controller.cancelPending();
      httpClient.setTokenProvider(() => null);
      httpClient.setSessionKeyProvider(undefined);
      httpClient.setRefreshHandler(undefined);
    };
  }, [controller]);
  const value = useMemo<AuthContextType>(() => ({
    ...state, login: controller.login, logout: controller.logout, selectTenant: controller.selectTenant,
    getAccessToken: controller.getAccessToken, getSessionKey: controller.getSessionKey,
    refreshSession: controller.refreshSession, expireSession: controller.expireSession,
    restoreSession: controller.restoreSession,
  }), [state, controller]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
