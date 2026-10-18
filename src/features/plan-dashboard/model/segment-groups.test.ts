import { describe, expect, it } from 'vitest';
import type { SourceSegmentView } from '@/api/v2/types/periods';
import { groupSegments, signalIdOf } from './segment-groups';

const minute = (i: number, source = 'signal:abc', quality: SourceSegmentView['quality'] = 'measured'): SourceSegmentView => ({
  source,
  method: 'counter_delta',
  from: new Date(Date.UTC(2026, 9, 17, 2, 30 + i)).toISOString(),
  to: new Date(Date.UTC(2026, 9, 17, 2, 31 + i)).toISOString(),
  quantity: '0.4',
  quality,
});

describe('actuals source segments (Marun E2E)', () => {
  it('groups one-minute segments per source with counts and the time span', () => {
    const segments = [...Array.from({ length: 480 }, (_, i) => minute(i)), minute(10, 'manual', 'estimated')];
    segments[5] = minute(5, 'signal:abc', 'missing');
    const [signal, manual] = groupSegments(segments);
    expect(signal).toMatchObject({ signalId: 'abc', from: '2026-10-17T02:30:00.000Z', to: '2026-10-17T10:30:00.000Z', qualityCounts: { measured: 479, missing: 1 } });
    expect(signal.segments).toHaveLength(480);
    expect(manual).toMatchObject({ source: 'manual', signalId: null, qualityCounts: { estimated: 1 } });
  });

  it('only a signal: source has a signal id', () => {
    expect(signalIdOf('signal:3ebbdace')).toBe('3ebbdace');
    expect(signalIdOf('pi_counter')).toBeNull();
  });
});
