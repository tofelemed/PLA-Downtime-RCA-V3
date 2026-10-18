import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ProductionEventView } from '@/api/v2/types/events';
import { EventDetailTabs } from './event-detail-tabs';

vi.mock('@/api/v2/queries/production-events', () => ({
  useProductionEventHistory: () => ({ data: { revisions: [], reviewItems: [], coding: [], relations: [] }, refetch: vi.fn() }),
}));
vi.mock('./source-effective-table', () => ({ SourceEffectiveTable: () => <p>Effective values</p> }));
vi.mock('./revision-timeline', () => ({ RevisionTimeline: () => <p>Revision timeline</p> }));
vi.mock('@/features/master-data/reliability/work-orders/repair-evidence-panel', () => ({ RepairEvidencePanel: () => <p>Repair evidence</p> }));
vi.mock('../stop-links/stop-links-panel', () => ({ StopLinksPanel: () => <p>Stop relationships</p> }));
vi.mock('./review-items-list', () => ({ ReviewItemsList: () => <p>Source conflict items</p> }));

const event = (physicalType: string): ProductionEventView => ({
  id: 'event-1', canonicalId: 'event-1', eventId: null, tenantId: 'plant-1', unitId: 'unit-1', assetId: null,
  originUnitId: null, originAssetId: null, plannedEndTime: null, planId: null, reasonCodeId: null, rcaId: null,
  eventType: null, status: null, source: null, sourceKind: 'manual', severity: null, description: null,
  startTime: '2026-10-15T10:00:00Z', endTime: '2026-10-15T11:00:00Z', isOpen: false,
  durationSeconds: 3600, elapsedSeconds: 3600, asOf: '2026-10-15T12:00:00Z',
  classification: { physicalType, scheduleClass: 'unplanned', oeeComponent: 'quality', impactMode: 'none', impactFraction: null },
  classificationBasis: null, impactCodeId: null, states: { physical: 'closed', coding: 'coded', rca: 'none' },
  quantity: '2.7', quantityUom: 't', cost: null, value: null, occurrenceId: 'occurrence-1', supersededByEventId: null, rowVersion: 1,
});

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

function open(type: string, tab: string) {
  return render(
    <MemoryRouter initialEntries={[`/events/event-1?tab=${tab}&keep=scope`]}>
      <EventDetailTabs event={event(type)} />
      <Location />
    </MemoryRouter>,
  );
}

describe('event detail tab deep links', () => {
  it.each(['repair', 'related', 'unknown'])('shows values for an unavailable %s tab on a non-stop event', (tab) => {
    open('quality_loss', tab);
    expect(screen.getByRole('tab', { name: 'Values' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toContain('Effective values');
    expect(screen.queryByRole('tab', { name: 'Repair' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Duplicates & repeats' })).toBeNull();
  });

  it.each([['repair', 'Repair evidence'], ['related', 'Stop relationships']])('retains %s deep links for downtime', (tab, content) => {
    open('downtime', tab);
    expect(screen.getByRole('tabpanel').textContent).toContain(content);
  });

  it.each(['conflicts', 'review'])('E-10: the source-conflict tab is named for what it holds (?tab=%s)', (tab) => {
    open('downtime', tab);
    expect(screen.getByRole('tab', { name: 'Source conflicts (0)' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('tab', { name: /^Review/ })).toBeNull();
    expect(screen.getByRole('tabpanel').textContent).toContain('Source conflict items');
  });

  it('keeps unrelated query state when leaving a fallback tab', () => {
    open('production_output', 'repair');
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'History' }), { button: 0, ctrlKey: false });
    expect(screen.getByTestId('location').textContent).toBe('?tab=history&keep=scope');
    expect(screen.getByRole('tabpanel').textContent).toContain('Revision timeline');
  });
});
