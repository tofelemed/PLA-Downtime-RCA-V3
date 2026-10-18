import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { HighlightTarget } from './highlight-target';

/** A page whose target row renders only after its data arrived (as the rate table does). */
function LatePage({ delayMs }: { delayMs: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);
  return ready ? <table><tbody><tr id="rate-r2" data-highlight-label="the planning rate version"><td>29 t/h</td></tr></tbody></table> : <p>Loading</p>;
}

const mount = (path: string, delayMs = 50) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <LatePage delayMs={delayMs} />
      <HighlightTarget />
    </MemoryRouter>,
  );

describe('deep-link highlight', () => {
  afterEach(() => vi.useRealTimers());

  it('waits for the linked row, scrolls to it, focuses and highlights it briefly, and announces it', async () => {
    vi.useFakeTimers();
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    mount('/planning/profiles/p1#rate-r2');
    await act(async () => { vi.advanceTimersByTime(60); });
    const row = document.getElementById('rate-r2') as HTMLElement;
    expect(row.dataset.highlighted).toBe('true');
    expect(row.className).toContain('ring-2');
    expect(scroll).toHaveBeenCalled();
    expect(document.activeElement).toBe(row);
    expect(screen.getByTestId('highlight-announcement').textContent).toBe('Showing the planning rate version.');
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(row.dataset.highlighted).toBeUndefined();
    expect(row.className).not.toContain('ring-2');
  });

  it('says so when the linked item never appears (decided or moved)', async () => {
    vi.useFakeTimers();
    mount('/planning/profiles/p1#rate-gone', 10);
    await act(async () => { vi.advanceTimersByTime(6500); });
    expect(screen.getByTestId('highlight-announcement').textContent).toMatch(/not on this page any more/);
  });

  it('ignores the skip link target', async () => {
    mount('/planning/profiles/p1#main-content');
    expect(screen.getByTestId('highlight-announcement').textContent).toBe('');
  });
});
