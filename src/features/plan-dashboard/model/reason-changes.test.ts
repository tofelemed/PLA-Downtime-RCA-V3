import { describe, expect, it } from 'vitest';
import { reasonChangesOf } from './reason-changes';

const line = (reasonCodeId: string | null, old: string | null, next: string | null, kind = 'availability') => ({ kind, reasonCodeId, uom: 't', old, new: next, delta: null });

describe('restatement reason changes (Marun E2E note E)', () => {
  it('a line that moved from one reason to another is one reason change', () => {
    const { changes, rest } = reasonChangesOf([line('speed-loss', '14', '0'), line(null, '0', '14'), line(null, '1', '1', 'quality')]);
    expect(changes).toEqual([{ kind: 'availability', uom: 't', from: 'speed-loss', to: null, quantity: '14' }]);
    expect(rest).toEqual([line(null, '1', '1', 'quality')]);
  });

  it('a quantity change or another kind is not a reason change', () => {
    expect(reasonChangesOf([line('a', '14', '0'), line('b', null, '13')]).changes).toEqual([]);
    expect(reasonChangesOf([line('a', '14', '0'), line('b', null, '14', 'performance')]).changes).toEqual([]);
    expect(reasonChangesOf([line('a', '14.000', null), line('b', null, '14')]).changes).toHaveLength(1);
  });
});
