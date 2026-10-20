import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isChunkLoadError } from './chunk-load-error';
import { RouteErrorBoundary } from './route-error-boundary';

function ThrowingPage({ error }: { error: Error }): never {
  throw error;
}

function Harness({ error, onReload }: { error: Error; onReload: () => void }) {
  const [path, setPath] = useState('/broken');
  return (
    <MemoryRouter>
      <nav>
        <button type="button" onClick={() => setPath('/other')}>Other page</button>
      </nav>
      <RouteErrorBoundary resetKey={path} onReload={onReload}>
        {path === '/broken' ? <ThrowingPage error={error} /> : <p>Other page content</p>}
      </RouteErrorBoundary>
    </MemoryRouter>
  );
}

/** jsdom reports errors React rethrows during render; the boundary handles them, so keep the output quiet. */
const quiet = (event: ErrorEvent) => event.preventDefault();

describe('RouteErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    window.addEventListener('error', quiet);
  });
  afterEach(() => {
    window.removeEventListener('error', quiet);
    vi.restoreAllMocks();
  });

  it('a throwing page shows the fallback while the shell around it stays, and Refresh reloads', () => {
    const onReload = vi.fn();
    render(<Harness error={new Error('boom')} onReload={onReload} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('button', { name: 'Other page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to dashboard' })).toHaveAttribute('href', '/dashboard');
    // users never see the technical message; development builds show it behind "Technical details"
    expect(screen.getByText(/This page could not be displayed/)).not.toHaveTextContent('boom');
    expect(screen.getByTestId('error-dev-details')).toHaveTextContent('boom');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('resets when the route changes', () => {
    render(<Harness error={new Error('boom')} onReload={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Other page' }));
    expect(screen.getByText('Other page content')).toBeInTheDocument();
    expect(screen.queryByTestId('route-error')).toBeNull();
  });

  it('asks for a reload when the page chunk failed to load', () => {
    const error = new TypeError('Failed to fetch dynamically imported module: /assets/page-abc.js');
    render(<Harness error={error} onReload={vi.fn()} />);
    expect(screen.getByText('This page needs to refresh')).toBeInTheDocument();
  });

  it('recognises chunk-load failures only', () => {
    expect(isChunkLoadError(new Error('Loading chunk 42 failed.'))).toBe(true);
    expect(isChunkLoadError(Object.assign(new Error('x'), { name: 'ChunkLoadError' }))).toBe(true);
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError('Loading chunk 1 failed')).toBe(false);
  });
});
