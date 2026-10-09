import { OutboxTail } from './outbox-tail';
import { RoutedMessage } from './realtime-message';
import { ReplayBuffer } from './replay-buffer';

const message = (room: string, seq: string): RoutedMessage => ({
  domainEventId: `outbox:${seq}`,
  room,
  seq,
  type: 'EventChanged',
  entityType: 'production_event',
  entityId: 'e',
  revision: 1,
  occurredAt: '2026-10-09T00:00:00.000Z',
  scope: { tenantId: 't', unitIds: [] },
  window: null,
});

describe('OutboxTail (plan 3.1)', () => {
  it('delivers each id once and advances over contiguous ids', () => {
    const tail = new OutboxTail(10, 1000);
    expect(tail.accept([11, 12], 0)).toEqual([11, 12]);
    expect(tail.floor).toBe(12);
    expect(tail.accept([12, 13], 0)).toEqual([13]);
    expect(tail.accept([5], 0)).toEqual([]);
  });

  it('waits for a late-committing lower id, then gives it up after the grace period', () => {
    const tail = new OutboxTail(0, 1000);
    expect(tail.accept([1, 3], 0)).toEqual([1, 3]);
    expect(tail.floor).toBe(1);
    expect(tail.accept([3], 500)).toEqual([]);
    expect(tail.floor).toBe(1);
    expect(tail.accept([2, 3], 600)).toEqual([2]);
    expect(tail.floor).toBe(3);
    expect(tail.accept([6], 700)).toEqual([6]);
    expect(tail.floor).toBe(3);
    expect(tail.accept([], 1800)).toEqual([]);
    expect(tail.floor).toBe(6);
  });

  it('bounds the bookkeeping on huge gaps', () => {
    const tail = new OutboxTail(0, 1000, 100);
    expect(tail.accept([5000], 0)).toEqual([5000]);
    expect(tail.floor).toBe(4900);
  });
});

describe('ReplayBuffer (plan 3.1)', () => {
  it('chains prevSeq per room', () => {
    const buffer = new ReplayBuffer(10);
    expect(buffer.append(message('a', '1')).prevSeq).toBeNull();
    expect(buffer.append(message('b', '2')).prevSeq).toBeNull();
    expect(buffer.append(message('a', '3')).prevSeq).toBe('1');
    expect(buffer.headSeq('a')).toBe('3');
  });

  it('resumes from a buffered seq, is current at the head, resyncs when the seq is unknown', () => {
    const buffer = new ReplayBuffer(2);
    for (const seq of ['1', '2', '3']) buffer.append(message('a', seq));
    expect(buffer.resume('a', undefined)).toEqual({
      kind: 'current',
      headSeq: '3',
    });
    expect(buffer.resume('a', '3').kind).toBe('current');
    const replay = buffer.resume('a', '2');
    expect(
      replay.kind === 'replay' && replay.messages.map((m) => m.seq),
    ).toEqual(['3']);
    expect(buffer.resume('a', '1').kind).toBe('resync');
    expect(buffer.resume('empty', '7')).toEqual({
      kind: 'resync',
      headSeq: null,
    });
  });
});
