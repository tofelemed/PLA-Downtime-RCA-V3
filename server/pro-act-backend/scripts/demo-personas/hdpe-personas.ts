/** Single-plant cast. The multi-plant catalogue remains available only for isolation test fixtures. */
import { DEMO_PERSONAS, Persona, Probe } from './persona-catalog';

function probesForPlant(probes: Probe[], actingPlant: string): Probe[] {
  return probes
    .filter((probe) => probe.plant === 'unknown' || probe.plant === actingPlant)
    .filter(
      (probe) =>
        probe.expect !== 'TENANT_NOT_ALLOWED' || probe.plant === 'unknown',
    )
    .map((probe) => ({
      ...probe,
      plant: probe.plant === 'unknown' ? 'unknown' : 'demoPlant',
    }));
}

export function hdpePersonas(): Persona[] {
  return DEMO_PERSONAS.map((persona) => ({
    ...persona,
    actingPlant: 'demoPlant',
    probes: probesForPlant(persona.probes, persona.actingPlant),
    users: persona.users.map((user) => ({
      ...user,
      homePlant: 'demoPlant',
      // A viewer in the only plant must not inherit the old home-plant Operator write rights.
      legacyRole: persona.key === 'viewer' ? 'viewer' : user.legacyRole,
      scopes:
        persona.key === 'viewer'
          ? [{ plant: 'demoPlant', kind: 'tenant', role: 'viewer' }]
          : user.scopes.map((scope) => ({ ...scope, plant: 'demoPlant' })),
      probes: probesForPlant(user.probes, persona.actingPlant),
    })),
  }));
}
