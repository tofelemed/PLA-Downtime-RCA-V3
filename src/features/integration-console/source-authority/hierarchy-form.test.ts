import { describe, expect, it } from 'vitest';
import { hierarchyDraftBody, initialHierarchyForm, validateHierarchyForm } from './hierarchy-form';

const POLICY = {
  measurement: 'output',
  primarySource: 'pi_counter',
  fallback: null,
  measurementHierarchy: {
    boundary: 'reactor_outlet',
    conditions: ['primary_missing', 'primary_stale'],
    entries: [
      {
        rank: 2,
        sourceClass: 'reconciled_record',
        source: 'external_report',
        signalSourceKey: null,
        boundary: 'packing',
        boundaryAdjustment: { inventoryChangeAccounted: true, lagSeconds: 0, evidenceRef: 'silo S-1 PA-2027-03' },
      },
      { rank: 1, sourceClass: 'calibrated_primary', source: 'pi_counter', signalSourceKey: 'FT-101.TOT', boundary: 'reactor_outlet' },
    ],
  },
};

describe('source authority hierarchy form', () => {
  it('starts from the version in force, best rank first, with its cross-boundary declaration', () => {
    const form = initialHierarchyForm(POLICY, 'unit');
    expect(form.boundary).toBe('reactor_outlet');
    expect(form.conditions).toEqual(['primary_missing', 'primary_stale']);
    expect(form.entries.map((e) => e.signalSourceKey)).toEqual(['FT-101.TOT', '']);
    expect(form.entries[1]).toMatchObject({ crossBoundary: true, inventoryChangeAccounted: true, evidenceRef: 'silo S-1 PA-2027-03' });
  });

  it('a version without a hierarchy starts with its primary source as rank 1', () => {
    const form = initialHierarchyForm({ ...POLICY, primarySource: 'mqtt', measurementHierarchy: undefined }, 'plant');
    expect(form.scope).toBe('plant');
    expect(form.entries).toHaveLength(1);
    expect(form.entries[0].source).toBe('mqtt');
  });

  it('checks only the well-formedness the request needs', () => {
    const form = initialHierarchyForm(null, 'unit');
    const errors = validateHierarchyForm(form);
    expect(errors.boundary).toBeTruthy();
    expect(errors.entry?.[0]).toBeTruthy();
    const cross = initialHierarchyForm(POLICY, 'unit');
    cross.entries[1] = { ...cross.entries[1], evidenceRef: ' ', lagSeconds: '1.5' };
    expect(validateHierarchyForm(cross).entry?.[1]).toBe('The lag is a whole number of seconds');
    expect(validateHierarchyForm(initialHierarchyForm(POLICY, 'unit'))).toEqual({});
  });

  it('builds the body with ranks in screen order; the plant scope sends no unit', () => {
    const form = initialHierarchyForm(POLICY, 'unit');
    const body = hierarchyDraftBody({ ...form, entries: [form.entries[1], form.entries[0]], notes: ' recalibrated ' }, 'unit-1');
    expect(body.unitId).toBe('unit-1');
    expect(body.notes).toBe('recalibrated');
    expect(body.measurementHierarchy?.entries.map((e) => [e.rank, e.source, e.boundaryAdjustment?.evidenceRef ?? null])).toEqual([
      [1, 'external_report', 'silo S-1 PA-2027-03'],
      [2, 'pi_counter', null],
    ]);
    const plant = hierarchyDraftBody({ ...form, scope: 'plant' }, 'unit-1');
    expect('unitId' in plant).toBe(false);
    expect('notes' in plant).toBe(false);
  });
});
