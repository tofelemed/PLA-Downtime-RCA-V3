import { describe, expect, it } from 'vitest';
import { reasonCodeLabel, reasonTreeRows } from './reason-code-options';

const code = (id: string, codeText: string, name: string, parentId: string | null, active = true) => ({
  id,
  code: codeText,
  name,
  parentId,
  path: id,
  active,
});

const library = [
  code('m', 'MECH', 'Mechanical', null),
  code('p', 'PUMP', 'Pump', 'm'),
  code('s', 'SEAL', 'Seal failure', 'p'),
  code('b', 'BRG', 'Bearing failure', 'p'),
  code('e', 'ELEC', 'Electrical trip', null),
  code('x', 'OLD', 'Retired reason', null, false),
  code('g', 'GRP', 'Group with retired children only', null),
  code('gx', 'GX', 'Retired child', 'g', false),
];

const shape = (rows: ReturnType<typeof reasonTreeRows>) => rows.map((r) => `${'  '.repeat(r.depth)}${r.code}${r.selectable ? '' : '/'}`);

describe('reasonTreeRows (FE-04)', () => {
  it('lists the active codes as a tree ordered by code; only leaves are selectable', () => {
    expect(shape(reasonTreeRows(library, ''))).toEqual(['ELEC', 'GRP', 'MECH/', '  PUMP/', '    BRG', '    SEAL']);
  });

  it('keeps matching leaves with their groups, searching code and name, ignoring case', () => {
    expect(shape(reasonTreeRows(library, 'seal'))).toEqual(['MECH/', '  PUMP/', '    SEAL']);
    expect(shape(reasonTreeRows(library, 'elec'))).toEqual(['ELEC']);
    expect(reasonTreeRows(library, 'zzz')).toEqual([]);
  });

  it('shows the whole subtree of a matching group', () => {
    expect(shape(reasonTreeRows(library, 'pump'))).toEqual(['MECH/', '  PUMP/', '    BRG', '    SEAL']);
  });

  it('survives a cycle in corrupt parent links', () => {
    const cyclic = [code('a', 'A', 'A', 'b'), code('b', 'B', 'B', 'a')];
    expect(() => reasonTreeRows(cyclic, '')).not.toThrow();
  });
});

describe('reasonCodeLabel (FE-05)', () => {
  it('labels a code with its parents and marks a retired code', () => {
    expect(reasonCodeLabel(library, 's')).toBe('SEAL · Seal failure — Mechanical › Pump');
    expect(reasonCodeLabel(library, 'x')).toBe('OLD · Retired reason (retired)');
    expect(reasonCodeLabel(library, 'missing')).toBeNull();
  });
});
