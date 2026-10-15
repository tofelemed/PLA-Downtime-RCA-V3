/**
 * Demo persona catalogue (demo data only): one entry per role the application defines, with 4–5
 * realistic users each, the scopes they hold (`user_scopes` rows) and the API probes that prove their
 * effective rights in the plant they act on. Every persona shares `DEMO_PERSONA_PASSWORD`.
 */
import { LegacyRole, mapLegacyRole } from '../../src/auth/roles/role-model';
import {
  approveDisposition,
  approvePolicy,
  createConnection,
  createEvent,
  createPlan,
  createPolicy,
  createRca,
  createRule,
  editAuditLog,
  FLAG_PROBE_KEY,
  listFlags,
  setFlag,
} from './persona-probes';

export { FLAG_PROBE_KEY };

export const DEMO_PERSONA_DOMAIN = 'demo.acme.com';
/** Documented in docs/DEMO_PERSONAS.md; meets the bootstrap rule (>= 12 chars) and the DTO rules (>= 8). */
export const DEMO_PERSONA_PASSWORD = 'Persona-2026!demo';

export type PlantKey = 'demoPlant' | 'demoPlant2' | 'partnerPlant';

export type ProbeExpectation =
  | 'allowed'
  | 'FORBIDDEN_ROLE'
  | 'READ_ONLY_ROLE'
  | 'TENANT_NOT_ALLOWED';

export interface PersonaScope {
  plant: PlantKey;
  kind: 'tenant' | 'unit';
  role: string;
  /** units.code inside `plant` for a `unit` scope */
  unitCode?: string;
}

export interface Probe {
  label: string;
  method: 'GET' | 'POST' | 'PUT';
  path: string;
  /** tenant sent as `X-Tenant-Id`; `unknown` is a uuid no tenant has */
  plant: PlantKey | 'unknown';
  body?: 'empty' | 'flag';
  expect: ProbeExpectation;
}

export interface PersonaUser {
  name: string;
  email: string;
  legacyRole: LegacyRole;
  homePlant: PlantKey;
  scopes: PersonaScope[];
  /** probes specific to this user, run after the persona's */
  probes: Probe[];
}

export interface Persona {
  key: string;
  label: string;
  /** plant the verification acts on (`X-Tenant-Id`) */
  actingPlant: PlantKey;
  users: PersonaUser[];
  probes: Probe[];
}

/** `DEMO-LINE-1` is the unit the unit-limited operators are restricted to. */
export const DEMO_PLANT_UNIT_CODES = ['DEMO-LINE-1', 'DEMO-LINE-2'] as const;

export function personaEmail(name: string): string {
  const local = name
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .trim()
    .split(/\s+/)
    .join('.');
  return `${local}@${DEMO_PERSONA_DOMAIN}`;
}

function tenantScope(plant: PlantKey, role: string): PersonaScope {
  return { plant, kind: 'tenant', role };
}

/** Tenant scopes of `role` in Demo Plant and Demo Plant 2. */
function inBothDemoPlants(role: string): PersonaScope[] {
  return [tenantScope('demoPlant', role), tenantScope('demoPlant2', role)];
}

interface UserOptions {
  extraScopes?: PersonaScope[];
  /** replaces the default home-tenant scope (what registration grants) */
  homeScope?: PersonaScope | null;
  probes?: Probe[];
}

function user(
  name: string,
  legacyRole: LegacyRole,
  homePlant: PlantKey,
  options: UserOptions = {},
): PersonaUser {
  const home =
    options.homeScope === undefined
      ? tenantScope(homePlant, mapLegacyRole(legacyRole))
      : options.homeScope;
  return {
    name,
    email: personaEmail(name),
    legacyRole,
    homePlant,
    scopes: [...(home ? [home] : []), ...(options.extraScopes ?? [])],
    probes: options.probes ?? [],
  };
}

/** Users of Demo Plant with the scope registration grants plus a tenant scope `role` in `plant`. */
function withScope(
  names: readonly string[],
  legacyRole: LegacyRole,
  plant: PlantKey,
  role: string,
): PersonaUser[] {
  return names.map((name) =>
    user(name, legacyRole, 'demoPlant', {
      extraScopes: [tenantScope(plant, role)],
    }),
  );
}

/** Operator whose only grant is a `unit` scope on DEMO-LINE-1 (no tenant-wide row). */
function unitLimitedOperator(name: string): PersonaUser {
  return user(name, 'Operator', 'demoPlant', {
    homeScope: {
      plant: 'demoPlant',
      kind: 'unit',
      role: 'operator',
      unitCode: DEMO_PLANT_UNIT_CODES[0],
    },
  });
}

/** Operator of Demo Plant 2 who holds nothing but `viewer` in Demo Plant. */
function viewerOfDemoPlant(name: string): PersonaUser {
  return user(name, 'Operator', 'demoPlant2', {
    extraScopes: [tenantScope('demoPlant', 'viewer')],
  });
}

// --- personas -----------------------------------------------------------------------------------

export const DEMO_PERSONAS: Persona[] = [
  {
    key: 'superAdmin',
    label: 'SuperAdmin',
    actingPlant: 'demoPlant',
    users: [
      'Helena Fischer',
      'Marcus Lindqvist',
      'Priya Raman',
      'Tomasz Nowak',
    ].map((name) => user(name, 'SuperAdmin', 'demoPlant')),
    probes: [
      setFlag('demoPlant', 'allowed'),
      listFlags('partnerPlant', 'allowed'),
      listFlags('unknown', 'TENANT_NOT_ALLOWED'),
    ],
  },
  {
    key: 'orgAdmin',
    label: 'OrgAdmin (Demo Org)',
    actingPlant: 'demoPlant',
    // selecting another plant needs a membership row there, even for OrgAdmin (RequestContextFactory)
    users: withScope(
      ['Isabel Moreno', 'Daniel Okafor', 'Sofia Bergstrom', 'Ravi Krishnan'],
      'OrgAdmin',
      'demoPlant2',
      'OrgAdmin',
    ),
    probes: [
      setFlag('demoPlant', 'allowed'),
      listFlags('demoPlant2', 'allowed'),
      listFlags('partnerPlant', 'TENANT_NOT_ALLOWED'),
      editAuditLog('demoPlant', 'FORBIDDEN_ROLE'),
    ],
  },
  {
    key: 'orgAdminPartner',
    label: 'OrgAdmin (Partner Org)',
    actingPlant: 'partnerPlant',
    users: [user('Lucas Ferreira', 'OrgAdmin', 'partnerPlant')],
    probes: [
      setFlag('partnerPlant', 'allowed'),
      listFlags('demoPlant', 'TENANT_NOT_ALLOWED'),
    ],
  },
  {
    key: 'tenantAdmin',
    label: 'TenantAdmin (Demo Plant)',
    actingPlant: 'demoPlant',
    users: [
      'Anna Keller',
      'Benjamin Carter',
      'Mei Tanaka',
      'Oliver Hughes',
    ].map((name) => user(name, 'TenantAdmin', 'demoPlant')),
    probes: [
      setFlag('demoPlant', 'allowed'),
      editAuditLog('demoPlant', 'FORBIDDEN_ROLE'),
      listFlags('demoPlant2', 'TENANT_NOT_ALLOWED'),
    ],
  },
  {
    key: 'tenantAdminPlant2',
    label: 'TenantAdmin (Demo Plant 2)',
    actingPlant: 'demoPlant2',
    users: [user('Chloe Dubois', 'TenantAdmin', 'demoPlant2')],
    probes: [
      setFlag('demoPlant2', 'allowed'),
      listFlags('demoPlant', 'TENANT_NOT_ALLOWED'),
    ],
  },
  {
    key: 'manager',
    label: 'Manager',
    actingPlant: 'demoPlant',
    users: [
      'Jonas Weber',
      'Fatima Haddad',
      'Erik Johansson',
      'Laura Rossi',
    ].map((name) => user(name, 'Manager', 'demoPlant')),
    probes: [
      setFlag('demoPlant', 'allowed'),
      editAuditLog('demoPlant', 'FORBIDDEN_ROLE'),
      approveDisposition('demoPlant', 'FORBIDDEN_ROLE'),
    ],
  },
  {
    key: 'engineerAnalyst',
    label: 'Engineer / Analyst',
    actingPlant: 'demoPlant',
    users: [
      user('Noah Schmidt', 'Engineer', 'demoPlant'),
      user('Aisha Bello', 'Engineer', 'demoPlant'),
      user('Mateo Alvarez', 'Engineer', 'demoPlant'),
      user('Hannah Novak', 'Analyst', 'demoPlant'),
      user('Samuel Osei', 'Analyst', 'demoPlant'),
    ],
    probes: [
      createPlan('demoPlant', 'allowed'),
      setFlag('demoPlant', 'FORBIDDEN_ROLE'),
      createRca('demoPlant', 'FORBIDDEN_ROLE'),
    ],
  },
  {
    key: 'operator',
    label: 'Operator',
    actingPlant: 'demoPlant',
    users: [
      user('Liam Murphy', 'Operator', 'demoPlant'),
      user('Yuki Sato', 'Operator', 'demoPlant'),
      user('Carlos Mendes', 'Operator', 'demoPlant'),
      unitLimitedOperator('Ingrid Hansen'),
      unitLimitedOperator('Amir Rahimi'),
    ],
    probes: [
      createEvent('demoPlant', 'allowed'),
      createPlan('demoPlant', 'FORBIDDEN_ROLE'),
    ],
  },
  {
    key: 'viewer',
    label: 'viewer (home Demo Plant 2)',
    actingPlant: 'demoPlant',
    users: [
      'Grace Whitfield',
      'Pedro Santos',
      'Nadia Petrova',
      'Kenji Nakamura',
    ].map(viewerOfDemoPlant),
    probes: [
      listFlags('demoPlant', 'allowed'),
      createEvent('demoPlant', 'READ_ONLY_ROLE'),
      setFlag('demoPlant', 'FORBIDDEN_ROLE'),
    ],
  },
  {
    key: 'reliabilityEngineer',
    label: 'reliability_engineer',
    actingPlant: 'demoPlant',
    users: withScope(
      ['Viktor Petrov', 'Amara Diallo', 'Sebastian Vogel', 'Leila Farouk'],
      'Engineer',
      'demoPlant',
      'reliability_engineer',
    ),
    probes: [
      createRca('demoPlant', 'allowed'),
      setFlag('demoPlant', 'FORBIDDEN_ROLE'),
    ],
  },
  {
    key: 'integrationAdmin',
    label: 'integration_admin',
    actingPlant: 'demoPlant',
    users: [
      user('Elena Marchetti', 'Engineer', 'demoPlant', {
        extraScopes: [tenantScope('demoPlant', 'integration_admin')],
      }),
      user('Omar Siddiqui', 'Analyst', 'demoPlant', {
        extraScopes: [tenantScope('demoPlant', 'integration_admin')],
      }),
      user('Freya Nilsson', 'Analyst', 'demoPlant', {
        extraScopes: [tenantScope('demoPlant', 'integration_admin')],
        probes: [listFlags('demoPlant2', 'TENANT_NOT_ALLOWED')],
      }),
      user('Diego Herrera', 'Engineer', 'demoPlant', {
        extraScopes: [
          tenantScope('demoPlant', 'integration_admin'),
          tenantScope('demoPlant2', 'integration_admin'),
        ],
        probes: [createConnection('demoPlant2', 'allowed')],
      }),
    ],
    probes: [
      createConnection('demoPlant', 'allowed'),
      setFlag('demoPlant', 'FORBIDDEN_ROLE'),
    ],
  },
  {
    key: 'masterDataAdmin',
    label: 'master_data_admin',
    actingPlant: 'demoPlant',
    users: withScope(
      ['Charlotte Evans', 'Hiro Yamamoto', 'Zara Qureshi', 'Felix Brandt'],
      'Analyst',
      'demoPlant',
      'master_data_admin',
    ),
    probes: [
      createRule('demoPlant', 'allowed'),
      setFlag('demoPlant', 'FORBIDDEN_ROLE'),
      createPolicy('demoPlant', 'FORBIDDEN_ROLE'),
    ],
  },
  // SME V1 (14 Oct 2026): finance maintains and approves valuation inputs, in both demo plants
  {
    key: 'financeMaintainer',
    label: 'finance_maintainer',
    actingPlant: 'demoPlant',
    users: ['Mina Sadeghi', 'Thomas Keller'].map((name) =>
      user(name, 'Analyst', 'demoPlant', {
        extraScopes: inBothDemoPlants('finance_maintainer'),
      }),
    ),
    probes: [
      createPolicy('demoPlant', 'allowed'),
      approvePolicy('demoPlant', 'FORBIDDEN_ROLE'),
    ],
  },
  {
    key: 'financeApprover',
    label: 'finance_approver',
    actingPlant: 'demoPlant',
    users: ['Reza Karimi', 'Sofia Lindqvist'].map((name) =>
      user(name, 'Analyst', 'demoPlant', {
        extraScopes: inBothDemoPlants('finance_approver'),
      }),
    ),
    probes: [
      approvePolicy('demoPlant', 'allowed'),
      createPolicy('demoPlant', 'FORBIDDEN_ROLE'),
    ],
  },
  // ISO 9001 (owner, 15 Oct 2026): Quality / Lab decides lot dispositions, independent of production
  {
    key: 'qualityApprover',
    label: 'quality_approver',
    actingPlant: 'demoPlant',
    users: [
      user('Parisa Rahimi', 'Analyst', 'demoPlant', {
        extraScopes: inBothDemoPlants('quality_approver'),
      }),
    ],
    probes: [
      approveDisposition('demoPlant', 'allowed'),
      setFlag('demoPlant', 'FORBIDDEN_ROLE'),
    ],
  },
];
