import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { V2ApiError } from '@/api/v2/errors';
import { isAuthFailure } from './auth-failure';
import { RouteErrorBoundary } from './route-error-boundary';

const auth = { expireSession: vi.fn() };
const toast = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

const { GlobalErrorListeners } = await import('./global-error-listeners');

const unauthorized = () => new V2ApiError(401, { code: 'UNAUTHORIZED', message: 'expired', correlationId: null, retryable: false });

function Throwing({ error }: { error: unknown }): never {
  throw error;
}

/** jsdom reports errors React rethrows during render; the boundary handles them, so keep the output quiet. */
const quiet = (event: ErrorEvent) => event.preventDefault();

function rejection(reason: unknown): Event {
  return Object.assign(new Event('unhandledrejection'), { reason, promise: Promise.resolve() });
}

describe('global error handling', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    window.addEventListener('error', quiet);
    auth.expireSession.mockReset();
    toast.mockReset();
  });
  afterEach(() => {
    window.removeEventListener('error', quiet);
    vi.restoreAllMocks();
  });

  it('recognises 401s from the v2 and v1 clients only', () => {
    expect(isAuthFailure(unauthorized())).toBe(true);
    expect(isAuthFailure(Object.assign(new Error('x'), { status: 401 }))).toBe(true);
    expect(isAuthFailure(Object.assign(new Error('x'), { status: 403 }))).toBe(false);
    expect(isAuthFailure(new Error('boom'))).toBe(false);
    expect(isAuthFailure(null)).toBe(false);
  });

  it('a 401 while rendering ends the session instead of showing the error page', () => {
    const onAuthFailure = vi.fn();
    const { container } = render(
      <MemoryRouter>
        <RouteErrorBoundary resetKey="/x" onAuthFailure={onAuthFailure}>
          <Throwing error={unauthorized()} />
        </RouteErrorBoundary>
      </MemoryRouter>,
    );
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
    expect(container).toBeEmptyDOMElement();
  });

  it('the outermost full-page fallback works without a router: Go to dashboard is a plain link', () => {
    render(
      <RouteErrorBoundary resetKey="app" fullPage navigation="document">
        <Throwing error={new Error('provider crashed')} />
      </RouteErrorBoundary>,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('link', { name: 'Go to dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('an unhandled rejection is shown as a friendly toast once; a 401 rejection signs out instead', () => {
    render(<GlobalErrorListeners />);
    window.dispatchEvent(rejection(new Error('socket hiccup at 0x1f')));
    window.dispatchEvent(rejection(new Error('socket hiccup at 0x1f')));
    expect(toast).toHaveBeenCalledTimes(1);
    const [content] = toast.mock.calls[0] as [{ title: string; description: string; variant: string }];
    expect(content.variant).toBe('destructive');
    expect(`${content.title} ${content.description}`).not.toContain('0x1f');
    window.dispatchEvent(rejection(unauthorized()));
    expect(auth.expireSession).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledTimes(1);
  });
});
