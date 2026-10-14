import { EntityManager } from 'typeorm';
import {
  KnowledgeDetails,
  KnowledgeVote,
  NO_ACTIONS,
} from './knowledge-v2.view';
import { RCAKnowledgeBase } from './rca-knowledge-base.entity';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const idsOf = (values: Array<string | null | undefined>): string[] => [
  ...new Set(values.filter((v): v is string => Boolean(v && UUID.test(v)))),
];

interface VoteRow {
  entry_id: string;
  helpful: number;
  not_helpful: number;
  mine: boolean | null;
}
interface CaseRow {
  id: string;
  title: string;
  status: string | null;
  effectiveness_verdict: string | null;
}
interface ActionRow {
  rca_id: string;
  total: number;
  done: number;
  cancelled: number;
}
interface NameRow {
  id: string;
  name: string;
}

interface DetailRows {
  votes: VoteRow[];
  cases: CaseRow[];
  actions: ActionRow[];
  units: NameRow[];
  assets: NameRow[];
}

export interface KnowledgeDetailsInput {
  tenantId: string;
  userId: string | null;
  entries: RCAKnowledgeBase[];
}

/** Five set-based queries for a whole page, each with the tenant predicate (no N+1). */
async function queryDetailRows(
  manager: EntityManager,
  input: KnowledgeDetailsInput,
): Promise<DetailRows> {
  const { tenantId, entries } = input;
  const caseIds = idsOf(entries.map((entry) => entry.rcaId));
  const userId = input.userId && UUID.test(input.userId) ? input.userId : null;
  const [votes, cases, actions, units, assets] = await Promise.all([
    manager.query<VoteRow[]>(
      `SELECT "entry_id"::text AS "entry_id", count(*) FILTER (WHERE "helpful")::int AS "helpful",
              count(*) FILTER (WHERE NOT "helpful")::int AS "not_helpful",
              bool_or("helpful") FILTER (WHERE "user_id" = $3::uuid) AS "mine"
         FROM "rca_knowledge_votes" WHERE "tenant_id" = $1::uuid AND "entry_id" = ANY($2::uuid[]) GROUP BY "entry_id"`,
      [tenantId, entries.map((entry) => entry.id), userId],
    ),
    manager.query<CaseRow[]>(
      `SELECT "id"::text AS "id", "title", "status", "effectiveness_verdict" FROM "rcas"
          WHERE "tenant_id" = $1 AND "id" = ANY($2::uuid[])`,
      [tenantId, caseIds],
    ),
    manager.query<ActionRow[]>(
      `SELECT "rca_id"::text AS "rca_id", count(*)::int AS "total",
              count(*) FILTER (WHERE "status" = 'done')::int AS "done",
              count(*) FILTER (WHERE "status" = 'cancelled')::int AS "cancelled"
         FROM "rca_actions" WHERE "tenant_id" = $1::uuid AND "rca_id" = ANY($2::uuid[]) GROUP BY "rca_id"`,
      [tenantId, caseIds],
    ),
    manager.query<NameRow[]>(
      `SELECT "id"::text AS "id", "name" FROM "units" WHERE "tenant_id" = $1::uuid AND "id" = ANY($2::uuid[])`,
      [tenantId, idsOf(entries.map((entry) => entry.unitId))],
    ),
    manager.query<NameRow[]>(
      `SELECT "id"::text AS "id", "name" FROM "assets" WHERE "tenant_id" = $1 AND "id" = ANY($2::uuid[])`,
      [tenantId, idsOf(entries.map((entry) => entry.assetId))],
    ),
  ]);
  return { votes, cases, actions, units, assets };
}

function myVoteOf(mine: boolean | null | undefined): KnowledgeVote | null {
  if (mine === true) return 'helpful';
  if (mine === false) return 'not_helpful';
  return null;
}

const byKey = <T>(rows: T[], key: (row: T) => string) =>
  new Map(rows.map((row) => [key(row), row]));

/**
 * Everything a page of entries shows beside its own columns: unit and asset names, the source case's
 * title / status and action counts, vote counts and the caller's own vote.
 */
export async function loadKnowledgeDetails(
  manager: EntityManager,
  input: KnowledgeDetailsInput,
): Promise<Map<string, KnowledgeDetails>> {
  const rows = await queryDetailRows(manager, input);
  const votes = byKey(rows.votes, (row) => row.entry_id);
  const actions = byKey(rows.actions, (row) => row.rca_id);
  const cases = byKey(rows.cases, (row) => row.id);
  const units = byKey(rows.units, (row) => row.id);
  const assets = byKey(rows.assets, (row) => row.id);
  return new Map(
    input.entries.map((entry): [string, KnowledgeDetails] => {
      const vote = votes.get(entry.id);
      const kase = entry.rcaId ? cases.get(entry.rcaId) : undefined;
      const action = entry.rcaId ? actions.get(entry.rcaId) : undefined;
      return [
        entry.id,
        {
          unitName: (entry.unitId && units.get(entry.unitId)?.name) || null,
          assetName: (entry.assetId && assets.get(entry.assetId)?.name) || null,
          caseTitle: kase?.title ?? null,
          caseStatus: kase?.status ?? null,
          caseEffectiveness: kase?.effectiveness_verdict ?? null,
          actions: action ?? NO_ACTIONS,
          helpful: vote?.helpful ?? 0,
          notHelpful: vote?.not_helpful ?? 0,
          myVote: myVoteOf(vote?.mine),
        },
      ];
    }),
  );
}
