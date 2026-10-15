import { describe, expect, it } from 'vitest';
import { siteOfSelection, siteOfUnit, unitsOfSite } from './model/site-units';

const SITES = [
  { id: 'main', isDefault: true },
  { id: 'port', isDefault: false },
];
const UNITS = [
  { id: 'u3', siteId: 'port' },
  { id: 'u1', siteId: null },
  { id: 'u2', siteId: 'main' },
];

describe('PLA analytics site filter', () => {
  it('a unit without a site belongs to the default site', () => {
    expect(siteOfUnit(UNITS[1], SITES)).toBe('main');
    expect(siteOfUnit(UNITS[1], [{ id: 'port', isDefault: false }])).toBeNull();
  });

  it('a site selects its units, sorted', () => {
    expect(unitsOfSite('main', UNITS, SITES)).toEqual(['u1', 'u2']);
    expect(unitsOfSite('port', UNITS, SITES)).toEqual(['u3']);
  });

  it('shows the site whose units are exactly the selection', () => {
    expect(siteOfSelection(['u2', 'u1'], UNITS, SITES)).toBe('main');
    expect(siteOfSelection(['u1'], UNITS, SITES)).toBe('');
    expect(siteOfSelection([], UNITS, SITES)).toBe('');
  });
});
