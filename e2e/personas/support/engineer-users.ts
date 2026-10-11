import { authenticate } from '../../test-utils/api-helpers';

/**
 * Persona users of the production engineer / analyst journeys (docs/DEMO_PERSONAS.md): three Engineers and
 * two Analysts of Demo Plant, all `production_engineer`. Setup that the API refuses to an engineer (master
 * data, approvals) is done by the demo manager approver `manager@acme.com`, never through the UI.
 */
export const PASSWORD = 'Persona-2026!demo';
export const PREFIX = 'P-ENG';
export const DEMO_PLANT_ID = '5f011848-1cb5-4b7c-b75a-8938b46260a9';

export interface PersonaUser {
  email: string;
  password: string;
  name: string;
}

const user = (handle: string, name: string): PersonaUser => ({ email: `${handle}@demo.acme.com`, password: PASSWORD, name });

export const NOAH = user('noah.schmidt', 'Noah Schmidt'); // Engineer: UI journeys
export const AISHA = user('aisha.bello', 'Aisha Bello'); // Engineer: API setup an engineer may do
export const MATEO = user('mateo.alvarez', 'Mateo Alvarez'); // Engineer: re-login / shared visibility
export const HANNAH = user('hannah.novak', 'Hannah Novak'); // Analyst: event coding, console refusal
export const SAMUEL = user('samuel.osei', 'Samuel Osei'); // Analyst: analytics, reports, RCA refusal

/** Manager approver demo user, used ONLY for setup the API refuses to engineers (approvals, master data). */
export const SETUP_MANAGER: PersonaUser = { email: 'manager@acme.com', password: 'demo123', name: 'Demo manager' };

export interface Session {
  token: string;
  userId: string;
  tenantId: string;
  organizationId: string;
}

/** API session of a persona (for setup and GET assertions only; the UI journeys log in through the form). */
export async function apiSession(who: PersonaUser): Promise<Session> {
  const session = await authenticate(who.email, who.password);
  const profile = session.user as { id?: string; userId?: string; tenantId: string; organizationId: string };
  return { token: session.accessToken, userId: profile.id ?? profile.userId ?? '', tenantId: profile.tenantId, organizationId: profile.organizationId };
}
