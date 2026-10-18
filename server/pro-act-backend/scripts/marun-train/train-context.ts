/**
 * Run context of the HDPE-TRAIN seeder: the SuperAdmin session, one session per person (logged in once),
 * the ids resolved so far and the created / kept tally. In a dry run nobody but the SuperAdmin logs in and
 * every read goes through the SuperAdmin session; nothing is written.
 */
import { Logger } from '@nestjs/common';
import { Tally } from '../demo-showcase/showcase-context';
import { emailOf, PEOPLE, PersonKey, SUPER_ADMIN } from './train-catalog';
import { TrainSession } from './train-session';

export interface TrainIds {
  organizationId: string;
  unitId: string;
  assetId: string;
  connectionId: string;
  /** product code → id */
  products: Map<string, string>;
  /** product code → approved profile id */
  profiles: Map<string, string>;
  /** person key → user id */
  users: Map<string, string>;
  /** signal source key → id */
  signals: Map<string, string>;
}

export class TrainContext {
  readonly logger = new Logger('MarunTrain');
  readonly tally = new Tally();
  readonly ids: TrainIds = {
    organizationId: '',
    unitId: '',
    assetId: '',
    connectionId: '',
    products: new Map(),
    profiles: new Map(),
    users: new Map(),
    signals: new Map(),
  };
  tenantId = '';
  private adminSession: TrainSession | null = null;
  private readonly sessions = new Map<string, TrainSession>();

  constructor(
    readonly baseUrl: string,
    readonly password: string,
    readonly dryRun: boolean,
  ) {}

  /** A SuperAdmin session without an acting plant (home plant), for the plant lookup. */
  homeAdmin(): TrainSession {
    return new TrainSession(SUPER_ADMIN.email, this.password, this.baseUrl);
  }

  /** The SuperAdmin acting in HDPE-TRAIN (logged in by `openAdmin`). */
  admin(): TrainSession {
    if (!this.adminSession) throw new Error('the SuperAdmin is not logged in');
    return this.adminSession;
  }

  async openAdmin(tenantId: string): Promise<void> {
    this.tenantId = tenantId;
    const session = new TrainSession(
      SUPER_ADMIN.email,
      this.password,
      this.baseUrl,
      tenantId,
    );
    await session.login();
    this.adminSession = session;
  }

  /** Logs every person in once (real run only). */
  async loginPeople(): Promise<void> {
    if (this.dryRun) return;
    for (const spec of PEOPLE) {
      const session = new TrainSession(
        emailOf(spec.key),
        this.password,
        this.baseUrl,
        this.tenantId,
      );
      await session.login();
      this.sessions.set(spec.key, session);
      if (session.userId) this.ids.users.set(spec.key, session.userId);
    }
  }

  /** The person's session; the SuperAdmin's in a dry run (reads only). */
  as(key: PersonKey): TrainSession {
    if (this.dryRun) return this.admin();
    const session = this.sessions.get(key);
    if (!session) throw new Error(`${key} is not logged in`);
    return session;
  }

  requestCount(): number {
    const people = [...this.sessions.values()];
    return people.reduce(
      (sum, session) => sum + session.requests,
      this.adminSession?.requests ?? 0,
    );
  }
}

/** True when `id` is known; otherwise records why the step part is skipped (dry run on a partial plant). */
export function known(
  ctx: TrainContext,
  id: string | undefined,
  what: string,
): id is string {
  if (id) return true;
  ctx.tally.add('skipped', 0, 0, `${what} not created yet`);
  return false;
}
