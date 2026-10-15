import { describe, expect, it } from 'vitest';
import type { SourceStatusMappingView } from '@/api/v2/types/status-mappings';
import { groupBySource, initialMappingForm, mappingCreateBody, validateMappingForm } from './status-mapping-form';

const VERSION: SourceStatusMappingView = {
  id: 'm1',
  sourceSystem: 'lims',
  version: 2,
  state: 'approved',
  statuses: [
    { status: 'AUTHORIZED', released: true },
    { status: 'COMPLETED', released: false },
  ],
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  effectiveTo: null,
  createdBy: 'u1',
  createdByName: 'Author',
  approvedBy: 'u2',
  approvedByName: 'Owner',
  approvedAt: '2026-01-02T00:00:00.000Z',
  inForce: true,
  notes: null,
};

describe('status mapping form (SME R13)', () => {
  it('a new version of a source starts from its statuses; a new source from one empty row', () => {
    expect(initialMappingForm(VERSION)).toMatchObject({ sourceSystem: 'lims', effectiveFrom: null, statuses: VERSION.statuses });
    expect(initialMappingForm(null).statuses).toEqual([{ status: '', released: false }]);
  });

  it('checks the source system, the start and at least one status', () => {
    expect(validateMappingForm({ sourceSystem: '-bad', effectiveFrom: null, statuses: [{ status: ' ', released: true }], notes: '' })).toEqual({
      sourceSystem: expect.any(String),
      effectiveFrom: expect.any(String),
      statuses: expect.any(String),
    });
    expect(validateMappingForm({ sourceSystem: 'lims', effectiveFrom: '2026-11-01T00:00:00.000Z', statuses: VERSION.statuses, notes: '' })).toEqual({});
  });

  it('sends only declared fields, without blank rows or empty notes', () => {
    const body = mappingCreateBody({
      sourceSystem: ' lims ',
      effectiveFrom: '2026-11-01T00:00:00.000Z',
      statuses: [
        { status: ' authorized ', released: true },
        { status: '', released: false },
      ],
      notes: '  ',
    });
    expect(body).toEqual({ sourceSystem: 'lims', effectiveFrom: '2026-11-01T00:00:00.000Z', statuses: [{ status: 'authorized', released: true }] });
  });

  it('groups versions by source in the server order', () => {
    const groups = groupBySource([VERSION, { ...VERSION, id: 'm0', version: 1, inForce: false }, { ...VERSION, id: 'i1', sourceSystem: 'import' }]);
    expect(groups.map((g) => [g.sourceSystem, g.versions.map((v) => v.id)])).toEqual([
      ['lims', ['m1', 'm0']],
      ['import', ['i1']],
    ]);
  });
});
