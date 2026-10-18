import { describe, expect, it } from 'vitest';
import { assetLabel, impactBasisText } from './impact-basis';

const facts = { sourceKind: 'derived', source: 'State engine', assetName: 'EXT1-Main' };

describe('impactBasisText (Marun E2E 1.5)', () => {
  it('names the approved impact rule from the stored basis, not the source', () => {
    expect(impactBasisText({ ...facts, basis: 'unit_rule' })).toBe('From the approved impact rule for EXT1-Main');
    expect(impactBasisText({ ...facts, basis: 'unit_rule', assetName: null })).toBe('From the approved impact rule for the unit');
  });

  it('states a person’s value, a standby takeover and the state-engine default distinctly', () => {
    expect(impactBasisText({ ...facts, basis: 'stated' })).toBe('Stated by a person');
    expect(impactBasisText({ ...facts, basis: 'standby_takeover' })).toContain('standby took over');
    expect(impactBasisText({ ...facts, basis: 'default' })).toBe('Derived from the unit state by State engine');
    expect(impactBasisText({ ...facts, basis: 'default', sourceKind: 'source', source: 'PI' })).toBe('From PI');
  });

  it('says nothing for a manual stop on the default or an unknown basis', () => {
    expect(impactBasisText({ ...facts, basis: 'default', sourceKind: 'manual' })).toBeNull();
    expect(impactBasisText({ ...facts, basis: '' })).toBeNull();
  });
});

describe('assetLabel (Marun regression)', () => {
  it('names the asset with its code', () => {
    expect(assetLabel({ name: 'Main drive and gearbox', code: 'EXT1-Main' })).toBe('Main drive and gearbox (EXT1-Main)');
    expect(impactBasisText({ ...facts, basis: 'unit_rule', assetName: assetLabel({ name: 'Main drive and gearbox', code: 'EXT1-Main' }) })).toBe(
      'From the approved impact rule for Main drive and gearbox (EXT1-Main)',
    );
    expect(assetLabel({ name: 'EXT1-Main', code: 'EXT1-Main' })).toBe('EXT1-Main');
    expect(assetLabel({ name: null, code: 'EXT1-Main' })).toBe('EXT1-Main');
    expect(assetLabel(undefined)).toBeNull();
  });
});
