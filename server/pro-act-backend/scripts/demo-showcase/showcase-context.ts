/**
 * Run context of the showcase seeder: the persona sessions of the plant (logged in once, picked
 * round-robin by role so the per-user rate limit is never the bottleneck), the window, the dry-run switch,
 * the ids resolved so far and a per-step tally of created / kept rows.
 */
import { Logger } from '@nestjs/common';
import {
  emailOf,
  PERSONA_PASSWORD,
  PersonaCast,
  PlantScenario,
} from './catalog-plants';
import { PersonaSession } from './showcase-client';
import { ShowcaseWindow } from './showcase-window';

export type Role = keyof PersonaCast;

export interface ProfileRef {
  id: string;
  unitKey: string;
  productCode: string;
  planningRate: number;
  sustainedRate: number;
}

/** Ids of the plant's showcase rows, filled step by step. */
export interface ShowcaseIds {
  units: Map<string, string>;
  /** `${unitKey}:${assetKind}` → asset id */
  assets: Map<string, string>;
  products: Map<string, string>;
  reasons: Map<string, string>;
  impacts: Map<string, string>;
  /** `${unitKey}:${productCode}` → profile */
  profiles: Map<string, ProfileRef>;
  /** persona → user id */
  users: Map<string, string>;
}

export class Tally {
  private readonly rows = new Map<
    string,
    { created: number; kept: number; note: string[] }
  >();

  add(step: string, created: number, kept: number, note?: string): void {
    const row = this.rows.get(step) ?? { created: 0, kept: 0, note: [] };
    row.created += created;
    row.kept += kept;
    if (note) row.note.push(note);
    this.rows.set(step, row);
  }

  created(step: string): void {
    this.add(step, 1, 0);
  }

  kept(step: string): void {
    this.add(step, 0, 1);
  }

  lines(): string[] {
    return [...this.rows.entries()].map(
      ([step, row]) =>
        `${step.padEnd(34)} created ${String(row.created).padStart(5)}  kept ${String(row.kept).padStart(5)}` +
        (row.note.length ? `  (${row.note.join('; ')})` : ''),
    );
  }
}

export class ShowcaseContext {
  readonly logger = new Logger('DemoShowcase');
  readonly tally = new Tally();
  readonly ids: ShowcaseIds = {
    units: new Map(),
    assets: new Map(),
    products: new Map(),
    reasons: new Map(),
    impacts: new Map(),
    profiles: new Map(),
    users: new Map(),
  };
  /** organization of the plant (v1 task bodies need it) */
  organizationId = '';
  private readonly sessions = new Map<string, PersonaSession>();
  private readonly turns = new Map<Role, number>();

  constructor(
    readonly baseUrl: string,
    readonly tenantId: string,
    readonly scenario: PlantScenario,
    readonly window: ShowcaseWindow,
    readonly seed: string,
    readonly dryRun: boolean,
  ) {}

  /** Logs every persona of the cast in (once each) and records their user ids. */
  async loginCast(): Promise<void> {
    const cast = this.scenario.cast;
    const personas = new Set<string>([
      ...cast.authors,
      ...cast.managers,
      ...cast.engineers,
      ...cast.operators,
      ...cast.reliability,
      ...cast.finance,
      ...cast.financeApprovers,
      ...cast.quality,
      ...cast.accountants,
      ...cast.metrology,
    ]);
    for (const persona of personas) {
      const session = new PersonaSession(
        emailOf(persona),
        PERSONA_PASSWORD,
        this.baseUrl,
        this.tenantId,
        this.seed,
      );
      await session.login();
      this.sessions.set(persona, session);
      if (session.userId) this.ids.users.set(persona, session.userId);
    }
  }

  /** The `index`-th persona of a role (wraps around). */
  persona(role: Role, index = 0): string {
    const list = this.scenario.cast[role];
    return list[index % list.length];
  }

  /** A session of the role; without an index the role's personas take turns. */
  as(role: Role, index?: number): PersonaSession {
    const turn = index ?? this.nextTurn(role);
    return this.session(this.persona(role, turn));
  }

  /** A manager other than `persona` (separation of duties). */
  approverOtherThan(persona: string, index = 0): PersonaSession {
    const managers = this.scenario.cast.managers.filter((m) => m !== persona);
    if (managers.length === 0)
      throw new Error(`no approver other than ${persona}`);
    return this.session(managers[index % managers.length]);
  }

  /** SME V1: a finance approver other than `persona` (separation of duties). */
  financeApproverOtherThan(persona: string, index = 0): PersonaSession {
    const approvers = this.scenario.cast.financeApprovers.filter(
      (m) => m !== persona,
    );
    if (approvers.length === 0)
      throw new Error(`no finance approver other than ${persona}`);
    return this.session(approvers[index % approvers.length]);
  }

  /** ISO 9001: a Quality / Lab approver other than `persona` (separation of duties). */
  qualityApproverOtherThan(persona: string, index = 0): PersonaSession {
    const approvers = this.scenario.cast.quality.filter((m) => m !== persona);
    if (approvers.length === 0)
      throw new Error(`no quality approver other than ${persona}`);
    return this.session(approvers[index % approvers.length]);
  }

  session(persona: string): PersonaSession {
    const session = this.sessions.get(persona);
    if (!session) throw new Error(`${persona} is not logged in`);
    return session;
  }

  personaOf(session: PersonaSession): string {
    return session.email.split('@')[0];
  }

  allSessions(role: Role): PersonaSession[] {
    return [...new Set(this.scenario.cast[role])].map((p) => this.session(p));
  }

  requestCount(): number {
    return [...this.sessions.values()].reduce((sum, s) => sum + s.requests, 0);
  }

  private nextTurn(role: Role): number {
    const turn = this.turns.get(role) ?? 0;
    this.turns.set(role, turn + 1);
    return turn;
  }
}

/** Runs `work` over `items` with one worker per session (each session keeps its own pace). */
export async function inParallel<T>(
  sessions: readonly PersonaSession[],
  items: readonly T[],
  work: (session: PersonaSession, item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const worker = async (session: PersonaSession) => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await work(session, item);
    }
  };
  await Promise.all(sessions.map((session) => worker(session)));
}
