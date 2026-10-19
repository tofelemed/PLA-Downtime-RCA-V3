import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { EventCodingView, EventRevisionView, ProductionEventHistoryView } from '@/api/v2/types/events';

vi.mock('@/features/ux-kit/labels/use-user-names', () => ({
  useUserNames: () => ({ nameOf: (id: string | null) => (id === 'u1' ? 'Leila Moradi' : id ? 'Former user' : '—'), isLoading: false }),
}));
vi.mock('../use-event-hub-env', () => ({ useEventHubEnv: () => ({ reasonName: () => 'MECH-GEARBOX' }) }));
vi.mock('../hooks/use-plant-format', () => ({ usePlantFormat: () => ({ dateTime: () => '18 Oct 10:00' }) }));

const { RevisionTimeline } = await import('./revision-timeline');

const revision = (extra: Partial<EventRevisionView>): EventRevisionView => ({
  id: `r${extra.revision ?? 1}`, revision: 1, kind: 'user', changeReason: null, actorId: null, actorKind: 'user', sourceRevision: null,
  createdAt: '2026-10-18T10:00:00.000Z', effectiveFacts: {}, sourceFacts: null, ...extra,
});
const coding = (extra: Partial<EventCodingView>): EventCodingView => ({
  id: 'c1', revision: 1, reasonCodeId: 'rc', impactCodeId: null, oeeCodeId: null, scheduleClass: 'unplanned', oeeComponent: 'availability',
  impactMode: 'full', impactFraction: null, comment: null, isOverride: false, reason: null, authorId: null, createdAt: '2026-10-18T10:00:00.000Z', ...extra,
});

describe('event history actors (owner finding 1)', () => {
  it('names the person, says "System (source)" for connectors and never "a user"', () => {
    const history: ProductionEventHistoryView = {
      revisions: [
        revision({ revision: 1, kind: 'source', actorKind: 'connector' }),
        revision({ revision: 2, actorId: 'u1' }),
        revision({ revision: 3, actorId: 'gone' }),
      ],
      coding: [coding({ revision: 1, authorId: 'u1', isOverride: true }), coding({ id: 'c2', revision: 2, authorId: null })],
      reviewItems: [],
      relations: [],
    };
    render(<RevisionTimeline history={history} sourceName="PI Extruder 1" />);
    expect(screen.getAllByTestId('revision-actor').map((n) => n.textContent)).toEqual(['Former user', 'Leila Moradi', 'System (PI extruder 1)']);
    expect(screen.getAllByTestId('coding-actor').map((n) => n.textContent)).toEqual(['System', 'Leila Moradi']);
    expect(document.body.textContent).not.toMatch(/a user/i);
    expect(screen.getByText(/classification set manually/)).toBeInTheDocument();
  });

  it('reads "System (state engine)" for engine revisions and coding, from the server actor source', () => {
    const history: ProductionEventHistoryView = {
      revisions: [
        revision({ revision: 1, kind: 'source', actorKind: 'system', actorSource: 'state-engine' }),
        revision({ revision: 2, kind: 'system', actorKind: 'system', actorSource: 'data-repair' }),
      ],
      coding: [coding({ revision: 1, authorId: null, authorSource: 'state-engine' })],
      reviewItems: [],
      relations: [],
    };
    render(<RevisionTimeline history={history} sourceName="State engine" />);
    expect(screen.getAllByTestId('revision-actor').map((n) => n.textContent)).toEqual(['the system', 'System (state engine)']);
    // QA L18: the service names the change, never "System change by System (data repair)"
    expect(document.body.textContent).toContain('Revision 2 · Data repair by the system');
    expect(document.body.textContent).not.toContain('System change by System');
    expect(screen.getAllByTestId('coding-actor').map((n) => n.textContent)).toEqual(['System (state engine)']);
    expect(document.body.textContent).not.toMatch(/by System ·/);
  });
});

describe('revision notes in words (QA audit F4)', () => {
  it('words the system notes and the investigation link, and keeps a typed reason as typed', () => {
    const notes = ['created', 'verification', 'failure_validation', 'RCA case linked', 'RCA case closed', 'bulk code: shift C cleanup', 'Restore OEE component'];
    const history: ProductionEventHistoryView = {
      revisions: notes.map((changeReason, index) => revision({ revision: notes.length - index, actorId: 'u1', changeReason })),
      coding: [],
      reviewItems: [],
      relations: [],
    };
    render(<RevisionTimeline history={history} />);
    expect(screen.getAllByTestId('revision-note').map((n) => n.textContent)).toEqual([
      'Created',
      'Coding verified',
      'Failure detail validated',
      'Investigation linked',
      'Investigation closed',
      'Bulk code: shift C cleanup',
      'Restore OEE component',
    ]);
    expect(document.body.textContent).not.toMatch(/failure_validation|RCA case/);
  });
});
