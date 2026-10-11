import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { assertRevision, staleRevision } from '../common/concurrency/revision';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { findEntry, RcaKnowledgeV2Service } from './knowledge-v2.service';
import { RcaKnowledgeV2View } from './knowledge-v2.view';

/** Net value of a vote for the legacy `helpful_votes` column (v1 screens read it). */
const netOf = (helpful: boolean | null): number =>
  helpful === null ? 0 : helpful ? 1 : -1;

function requireUser(context: RequestContext): string {
  if (!context.userId) {
    throw new ForbiddenException({
      code: 'USER_REQUIRED',
      message: 'a signed-in user is required to vote',
    });
  }
  return context.userId;
}

/**
 * Writes of the v2 knowledge base (owner decision 2026-10-12): one vote per user and entry (a repeat
 * vote replaces the earlier one, so the same vote twice changes nothing), and publish / unpublish under
 * `If-Match`. The legacy net `helpful_votes` column moves by the vote's change so v1 readers agree.
 */
@Injectable()
export class RcaKnowledgeV2CommandsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly entries: RcaKnowledgeV2Service,
  ) {}

  async vote(
    context: RequestContext,
    id: string,
    helpful: boolean,
  ): Promise<RcaKnowledgeV2View> {
    const userId = requireUser(context);
    await this.dataSource.transaction(async (manager) => {
      await findEntry(manager, context, id, true);
      const previous = await this.previousVote(manager, id, userId);
      if (previous === helpful) return;
      await manager.query(
        `INSERT INTO "rca_knowledge_votes" ("tenant_id", "row_version", "entry_id", "user_id", "helpful", "created_by", "updated_by")
         VALUES ($1, 1, $2, $3, $4, $3, $3)
         ON CONFLICT ("entry_id", "user_id") DO UPDATE
           SET "helpful" = EXCLUDED."helpful", "row_version" = "rca_knowledge_votes"."row_version" + 1,
               "updated_by" = EXCLUDED."updated_by", "updated_at" = now()`,
        [requireTenantId(context), id, userId, helpful],
      );
      await manager.query(
        `UPDATE "rca_knowledge_base" SET "helpful_votes" = "helpful_votes" + $2 WHERE "id" = $1`,
        [id, netOf(helpful) - netOf(previous)],
      );
    });
    return this.entries.get(context, id);
  }

  /** Publishes (`published` true) or withdraws an entry; asking for the current state changes nothing. */
  async setPublished(
    context: RequestContext,
    target: { id: string; expectedRowVersion: number },
    published: boolean,
  ): Promise<RcaKnowledgeV2View> {
    await this.dataSource.transaction(async (manager) => {
      const entry = await findEntry(manager, context, target.id, true);
      assertRevision(entry.rowVersion, target.expectedRowVersion);
      if (entry.isPublished === published) return;
      const result: [unknown[], number] = await manager.query(
        `UPDATE "rca_knowledge_base"
            SET "is_published" = $3, "published_at" = CASE WHEN $3 THEN now() ELSE NULL END,
                "published_by" = CASE WHEN $3 THEN $4 ELSE NULL END,
                "row_version" = "row_version" + 1, "updated_at" = now()
          WHERE "id" = $1 AND "row_version" = $2`,
        [target.id, target.expectedRowVersion, published, context.userId],
      );
      if (result[1] === 0) throw staleRevision();
    });
    return this.entries.get(context, target.id);
  }

  private async previousVote(
    manager: EntityManager,
    entryId: string,
    userId: string,
  ): Promise<boolean | null> {
    const rows: Array<{ helpful: boolean }> = await manager.query(
      `SELECT "helpful" FROM "rca_knowledge_votes" WHERE "entry_id" = $1 AND "user_id" = $2`,
      [entryId, userId],
    );
    return rows[0]?.helpful ?? null;
  }
}
