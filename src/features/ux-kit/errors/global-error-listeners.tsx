import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { createLogger } from '@/lib/logger';
import { isAuthFailure } from './auth-failure';
import { UNKNOWN_MESSAGE } from './error-messages';
import { friendlyToastContent } from './friendly-toast';

const log = createLogger('global-errors');
/** the same message is toasted at most once in this window */
const TOAST_REPEAT_MS = 5_000;

/** An API error (it has an HTTP status) gets its friendly server-based text; anything else the generic one. */
function toastContentOf(reason: unknown): { title: string; description: string } {
  const isApiError = typeof reason === 'object' && reason !== null && typeof (reason as { status?: unknown }).status === 'number';
  return isApiError ? friendlyToastContent(reason) : { title: UNKNOWN_MESSAGE.title, description: UNKNOWN_MESSAGE.text };
}

/**
 * Errors outside React rendering (render crashes are the error boundaries'): an unhandled promise
 * rejection ends the session when it is a 401, otherwise it is logged and shown as a friendly toast
 * (an API error's plain text, else the generic message — never a script error's raw message); a stray
 * script error is logged only. Mounted once inside the auth provider.
 */
export function GlobalErrorListeners() {
  const { expireSession } = useAuth();
  const { toast } = useToast();
  const lastToast = useRef<{ text: string; at: number } | null>(null);

  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason: unknown = event.reason;
      if (isAuthFailure(reason)) {
        log.warn('A request failed with 401 outside a page; signing out');
        expireSession();
        return;
      }
      log.error('Unhandled promise rejection', { error: reason });
      const content = toastContentOf(reason);
      const now = Date.now();
      const last = lastToast.current;
      if (last && last.text === content.title && now - last.at < TOAST_REPEAT_MS) return;
      lastToast.current = { text: content.title, at: now };
      toast({ ...content, variant: 'destructive' });
    };
    const onError = (event: ErrorEvent) => log.error('Unhandled error', { error: event.error ?? event.message });
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('error', onError);
    return () => {
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('error', onError);
    };
  }, [expireSession, toast]);

  return null;
}
