import { describe, expect, it } from 'vitest';
import { reasonCodeOptions } from './reason-code-options';

const code = (id: string, codeText: string, name: string, parentId: string | null, path: string, active = true) => ({
  id,
  code: codeText,
  name,
  parentId,
  path,
  active,
});

const library = [
  code('m', 'MECH', 'Mechanical', null, 'MECH'),
  code('p', 'PUMP', 'Pump', 'm', 'MECH/PUMP'),
  code('s', 'SEAL', 'Seal failure', 'p', 'MECH/PUMP/SEAL'),
  code('b', 'BRG', 'Bearing failure', 'p', 'MECH/PUMP/BRG'),
  code('e', 'ELEC', 'Electrical trip', null, 'ELEC'),
  code('x', 'OLD', 'Retired reason', null, 'OLD', false),
];

describe('reasonCodeOptions (FE-04)', () => {
  it('offers only active leaf codes, in path order, labelled with their parents', () => {
    expect(reasonCodeOptions(library, '').map((o) => [o.id, o.label])).toEqual([
      ['e', 'ELEC · Electrical trip'],
      ['b', 'BRG · Bearing failure — Mechanical › Pump'],
      ['s', 'SEAL · Seal failure — Mechanical › Pump'],
    ]);
  });

  it('finds codes by code, name or a parent name, ignoring case', () => {
    expect(reasonCodeOptions(library, 'seal').map((o) => o.id)).toEqual(['s']);
    expect(reasonCodeOptions(library, 'pump').map((o) => o.id)).toEqual(['b', 's']);
    expect(reasonCodeOptions(library, 'elec').map((o) => o.id)).toEqual(['e']);
  });

  it('keeps the current value visible even when retired or filtered out', () => {
    expect(reasonCodeOptions(library, 'seal', 'x').map((o) => o.id)).toEqual(['x', 's']);
  });
});
