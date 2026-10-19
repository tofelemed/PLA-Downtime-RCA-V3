import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useScrollToTop } from '../hooks/use-scroll-to-top';
import { eventPageTitle, eventTrail } from './event-trail';

describe('event page trail (QA audit L15 / L16)', () => {
  it('keeps an analysis origin, with its filters, in the breadcrumb', () => {
    const back = { to: '/downtime/causes?analysis=reasons&reasons=r1&drill=r2', label: 'Causes & Pareto' };
    expect(eventTrail(back, 'Downtime · HDPE Extruder 1')).toEqual([
      { label: 'Causes & Pareto', to: '/downtime/causes?analysis=reasons&reasons=r1&drill=r2' },
      { label: 'Downtime · HDPE Extruder 1' },
    ]);
  });

  it('leaves an Event Hub origin to the automatic trail (which keeps the list filters)', () => {
    expect(eventTrail({ to: '/events?kinds=downtime', label: 'Event Hub' }, 'Stop')).toBeUndefined();
    expect(eventTrail({ to: '/events/e1', label: 'Downtime · Unit 1' }, 'Edit')).toBeUndefined();
  });

  it('names the event the same way on its page and in the edit page breadcrumb', () => {
    const event = { unitId: 'u1', classification: { physicalType: 'downtime' } } as Parameters<typeof eventPageTitle>[0];
    expect(eventPageTitle(event, () => 'HDPE Extruder 1')).toBe('Downtime · HDPE Extruder 1');
  });

  it('opens a page at its top', () => {
    const page = document.scrollingElement ?? document.documentElement;
    page.scrollTop = 412;
    const { rerender } = renderHook(({ id }) => useScrollToTop(id), { initialProps: { id: 'e1' } });
    expect(page.scrollTop).toBe(0);
    page.scrollTop = 300;
    rerender({ id: 'e1' });
    expect(page.scrollTop).toBe(300);
    rerender({ id: 'e2' });
    expect(page.scrollTop).toBe(0);
  });
});
