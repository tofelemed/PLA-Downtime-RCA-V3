import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { EventRevisionView } from '@/api/v2/types/events';

vi.mock('@/features/ux-kit/labels/use-user-names', () => ({
  useUserNames: () => ({ nameOf: () => 'Leila Moradi', isLoading: false }),
}));
vi.mock('../hooks/use-fact-resolvers', () => ({
  useFactResolvers: () => ({
    unitName: () => 'Extruder 1',
    assetName: () => 'Gearbox',
    reasonName: () => 'SPEED-LOSS',
    impactName: () => 'Impact',
    userName: () => 'Leila Moradi',
    dateTime: () => '18 Oct 10:00',
    duration: () => '30 min',
  }),
}));

const { SourceEffectiveTable } = await import('./source-effective-table');

const revision = (number: number, facts: Record<string, unknown>): EventRevisionView => ({
  id: `r${number}`, revision: number, kind: 'user', changeReason: null, actorId: 'u1', actorKind: 'user', sourceRevision: null,
  createdAt: '2026-10-18T10:00:00.000Z', effectiveFacts: facts, sourceFacts: null,
});

function rowOf(label: string): HTMLElement {
  const cell = screen.getAllByRole('cell').find((node) => node.textContent?.startsWith(label));
  const row = cell?.closest('tr');
  if (!row) throw new Error(`row ${label} missing`);
  return row;
}

describe('event Values tab reads the current event (O1)', () => {
  it('shows the coding state of the event row, not the facts frozen in the latest revision', () => {
    const revisions = [revision(1, { codingState: 'uncoded', status: 'Open' }), revision(4, { codingState: 'coded', status: 'Coded' })];
    render(<SourceEffectiveTable revisions={revisions} overriddenFields={[]} current={{ codingState: 'uncoded', status: 'Open' }} />);
    expect(within(rowOf('Coding state')).getByText('Uncoded')).toBeInTheDocument();
    expect(within(rowOf('Status')).getByText('Open')).toBeInTheDocument();
    expect(screen.queryByText('Coded')).toBeNull();
    expect(screen.getByTestId('source-effective-note').textContent).toContain('latest: revision 4');
  });
});
