import { describe, expect, it } from 'vitest';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import type { CodingGateView } from '@/api/v2/types/stop-coding';
import { stickyPlacement, submitBlockers } from './workflow-blockers';

const view = (patch: Partial<ReconciliationView>, lifecycle: ReconciliationView['revision']['lifecycle'] = 'draft') =>
  ({ baseRunId: 'run-1', revision: { lifecycle }, ...patch }) as unknown as ReconciliationView;
const gate = (patch: Partial<CodingGateView>) => ({ mode: 'block', passes: false, uncoded: 3, ...patch }) as CodingGateView;

describe('what blocks Submit (UX audit D-10)', () => {
  it('nothing for a calculated draft without unsaved edits', () => {
    expect(submitBlockers(view({}), false)).toEqual([]);
  });

  it('lists a missing run, a failing blocking coding gate and unsaved edits from the server flags', () => {
    const codes = submitBlockers(view({ baseRunId: null, codingGate: gate({}) }), true).map((b) => b.code);
    expect(codes).toEqual(['NOT_CALCULATED', 'CODING_GATE', 'UNSAVED_LINES']);
  });

  it('a warning-only or passing gate does not block', () => {
    expect(submitBlockers(view({ codingGate: gate({ mode: 'warn' }) }), false)).toEqual([]);
    expect(submitBlockers(view({ codingGate: gate({ passes: true }) }), false)).toEqual([]);
  });

  it('only a draft is submitted, so other lifecycles have no blockers', () => {
    expect(submitBlockers(view({ baseRunId: null }, 'in_review'), true)).toEqual([]);
  });
});

describe('sticky workflow strip placement', () => {
  it('links to Review & close from other sections and is compact there or on the approved view', () => {
    expect(stickyPlacement('actuals', 'current', '/r')).toEqual({ reviewHref: '/r', compact: false });
    expect(stickyPlacement('review', 'current', '/r')).toEqual({ reviewHref: null, compact: true });
    expect(stickyPlacement('', 'approved', '/r')).toEqual({ reviewHref: '/r', compact: true });
  });
});
