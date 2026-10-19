import { extraPlantRoles } from '../../scripts/marun-train/step-people';
import { PEOPLE } from '../../scripts/marun-train/train-catalog';

/** QA audit 2026-10-19 (guide roles only): the seeder leaves each person exactly the guide's plant roles. */
describe('marun-train guide roles', () => {
  const kamran = PEOPLE.find((p) => p.key === 'kamran');
  const grant = (role: string, scopeId = 'plant', scopeKind = 'tenant') => ({
    id: `${role}-${scopeId}`,
    role,
    scopeKind,
    scopeId,
  });

  it('every persona holds exactly one guide role', () => {
    for (const person of PEOPLE) expect(person.roles).toHaveLength(1);
  });

  it('revokes the legacy-role mirror, keeps the guide role and grants elsewhere', () => {
    if (!kamran) throw new Error('kamran missing from the catalogue');
    const held = [
      grant('finance_approver'),
      grant('production_engineer'),
      grant('production_engineer', 'other-plant'),
      grant('viewer', 'unit-1', 'unit'),
    ];
    expect(extraPlantRoles(kamran, held, 'plant').map((row) => row.id)).toEqual(
      ['production_engineer-plant'],
    );
  });
});
