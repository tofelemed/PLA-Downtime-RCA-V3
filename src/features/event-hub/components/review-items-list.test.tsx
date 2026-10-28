import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { EventReviewItemView, ReviewItemKind } from '@/api/v2/types/events';

const submit = vi.fn().mockResolvedValue(undefined);
vi.mock('@/features/auth/use-capabilities', () => ({ useCapabilities: () => ({ canWriteEvents: true }) }));
vi.mock('@/api/v2/queries/event-commands', () => ({ useResolveReviewItem: () => ({ submit, isPending: false, error: null }) }));
vi.mock('../hooks/use-plant-format', () => ({ usePlantFormat: () => ({ dateTime: () => '28 Oct 10:00' }) }));

const { ReviewItemsList } = await import('./review-items-list');

const EVENT = { id: 'event-1', rowVersion: 3, startTime: '2026-10-28T06:00:00Z', endTime: '2026-10-28T06:30:00Z' };
const item = (kind: ReviewItemKind, field: string | null): EventReviewItemView => ({
  id: `item-${kind}`, eventId: EVENT.id, kind, field, state: 'open', resolvedBy: null, resolvedAt: null, createdAt: '2026-10-28T06:31:00Z',
});

describe('review item decisions (F2)', () => {
  it('a source re-coding is labelled and can only be dismissed', () => {
    const recoded = item('source_reason_changed', 'reason');
    render(<ReviewItemsList event={EVENT} items={[recoded]} />);
    expect(screen.getByText('Source now reports a different reason')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept source' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Keep my value' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(submit).toHaveBeenCalledWith({ item: recoded, event: EVENT, decision: 'dismiss' });
  });

  it('a source/override conflict keeps the keep / accept decision', () => {
    render(<ReviewItemsList event={EVENT} items={[item('source_vs_override_conflict', 'description')]} />);
    expect(screen.getByRole('button', { name: 'Keep my value' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept source' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });
});
