import { SCOPE_ROLES } from '../../../src/auth/roles/role-model';

export const SEED_ROLES = [
  'SuperAdmin',
  'OrgAdmin',
  'TenantAdmin',
  'Manager',
  'Analyst',
  'Engineer',
  'Operator',
] as const;

export type SeedRole = (typeof SEED_ROLES)[number];

export interface SeedUser {
  email: string;
  name: string;
  role: SeedRole;
  scopeRole: string | null;
}

const HEADER = ['email', 'name', 'role', 'scope_role'];
const EMAIL_RE = /^[^\s@,"]+@[^\s@,"]+\.[^\s@,"]+$/;

/** Splits one CSV line; double quotes wrap a field that holds commas, "" is a literal quote. */
function splitLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted && ch === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields.map((field) => field.trim());
}

function isRole(value: string): value is SeedRole {
  return (SEED_ROLES as readonly string[]).includes(value);
}

function parseRow(fields: string[], lineNo: number): SeedUser {
  const [rawEmail, name, role, scopeRole] = fields;
  const email = rawEmail.toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error(`line ${lineNo}: invalid e-mail`);
  if (!name) throw new Error(`line ${lineNo}: name is empty`);
  if (!isRole(role)) throw new Error(`line ${lineNo}: unknown role "${role}"`);
  if (scopeRole && !(SCOPE_ROLES as readonly string[]).includes(scopeRole)) {
    throw new Error(`line ${lineNo}: unknown scope_role "${scopeRole}"`);
  }
  return { email, name, role, scopeRole: scopeRole || null };
}

/** Parses the seed-users CSV (header `email,name,role,scope_role`); errors read `line N: <reason>`. */
export function parseSeedUsers(text: string): SeedUser[] {
  const lines = text.split(/\r?\n/);
  if (splitLine(lines[0] ?? '').join(',') !== HEADER.join(',')) {
    throw new Error(`line 1: header must be ${HEADER.join(',')}`);
  }
  const seen = new Set<string>();
  const users: SeedUser[] = [];
  lines.forEach((line, index) => {
    if (index === 0 || line.trim() === '') return;
    const fields = splitLine(line);
    if (fields.length !== HEADER.length) {
      throw new Error(`line ${index + 1}: expected ${HEADER.length} columns`);
    }
    const user = parseRow(fields, index + 1);
    if (seen.has(user.email)) {
      throw new Error(`line ${index + 1}: duplicate e-mail`);
    }
    seen.add(user.email);
    users.push(user);
  });
  return users;
}
