import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { CursorCodec, invalidCursor } from '../v2/common/cursor-codec';
import { recommendationTitles } from './knowledge-v2.view';

/** A lesson another plant of the organization shared (CA9): read-only, redacted to the factual lesson. */
export interface SharedLessonV2View {
  id: string;
  /** the plant (tenant) that shared it */
  sourcePlant: string;
  title: string;
  problemStatement: string | null;
  rootCause: string | null;
  recommendations: string[];
  failureMode: string | null;
  equipmentCategory: string | null;
  /** verified_practice (effective), caution (not effective) or unverified */
  lessonStatus: string;
  sharedAt: string;
}

export const SHARED_LESSON_NOTE =
  'Lessons shared by other plants of your organization. Check process chemistry, operating envelope and ' +
  'design fit, and use your own change control before copying a modification.';

interface Row {
  id: string;
  source_plant: string;
  title: string;
  problem_statement: string | null;
  root_cause: string | null;
  recommendations: string | null;
  failure_mode: string | null;
  equipment_category: string | null;
  lesson_status: string | null;
  shared_at: Date;
}

function parseList(text: string | null): unknown {
  if (!text) return [];
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return [];
  }
}

/**
 * CA9 lessons of other plants in the caller's organization, through `rca_shared_lessons()`: only entries
 * their plant published and chose to share, only plants of the same organization, only the factual lesson
 * columns (no people, assets, cases or events), newest first. Tenant boundaries hold: the function reads
 * for a tenant the session is bound to and never returns another organization's rows.
 */
@Injectable()
export class RcaKnowledgeSharedService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async list(
    context: RequestContext,
    query: { cursor?: string; limit: number },
  ): Promise<{ items: SharedLessonV2View[]; nextCursor: string | null }> {
    const tenantId = requireTenantId(context);
    const after = query.cursor ? CursorCodec.decode(query.cursor) : null;
    if (after && typeof after.sortValue !== 'string') throw invalidCursor();
    const rows: Row[] = await this.dataSource.query(
      `SELECT * FROM rca_shared_lessons($1::uuid, $2::int, $3::timestamptz, $4::uuid)`,
      [tenantId, query.limit + 1, after?.sortValue ?? null, after?.id ?? null],
    );
    const items = rows.slice(0, query.limit).map((row) => ({
      id: row.id,
      sourcePlant: row.source_plant,
      title: row.title,
      problemStatement: row.problem_statement,
      rootCause: row.root_cause,
      recommendations: recommendationTitles(parseList(row.recommendations)),
      failureMode: row.failure_mode,
      equipmentCategory: row.equipment_category,
      lessonStatus: row.lesson_status ?? 'unverified',
      sharedAt: new Date(row.shared_at).toISOString(),
    }));
    const last = items[items.length - 1];
    return {
      items,
      nextCursor:
        rows.length > query.limit && last
          ? CursorCodec.encode({ sortValue: last.sharedAt, id: last.id })
          : null,
    };
  }
}
