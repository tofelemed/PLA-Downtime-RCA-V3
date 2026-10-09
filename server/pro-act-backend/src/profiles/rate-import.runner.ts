import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { IMPORT_RATE_KIND, RateKind } from '../domain/profiles/profile.types';
import {
  ImportRowError,
  parseImport,
} from '../domain/profiles/rate-import-rows';
import { RateImport, RateImportCounts } from './entities/rate-import.entity';
import { UnitProductRate } from './entities/unit-product-rate.entity';
import { recordImportApplied } from './profile-events';
import {
  overlapsWithApproved,
  ResolvedImportRow,
  resolveImportRows,
} from './rate-import-resolver';
import { nextVersion } from './versioning';

const INSERT_CHUNK = 500;

type Outcome =
  | { state: 'completed'; counts: RateImportCounts }
  | { state: 'failed'; counts: RateImportCounts; report: ImportRowError[] };

/**
 * Worker side of rate imports (plan 2.2 step 4): claims one queued document at a time (`FOR UPDATE
 * SKIP LOCKED`) and applies it in the same transaction — a crash leaves it queued. A document is
 * applied whole or not at all: any invalid row fails it with a report of every error. Applying a
 * revision retires the approved rows of earlier revisions of the same external id (correction) and
 * inserts the new rows as approved versions (`source = import`), all in one transaction.
 */
@Injectable()
export class RateImportRunner {
  private readonly logger = new Logger(RateImportRunner.name);

  constructor(
    @InjectRepository(RateImport)
    private readonly imports: Repository<RateImport>,
  ) {}

  /** Processes queued imports until none is left; returns how many ran. */
  async runPending(): Promise<number> {
    let processed = 0;
    for (;;) {
      const claimed = await this.runNext();
      if (claimed === null) return processed;
      processed += 1;
    }
  }

  /** One queued import (its id), or null when the queue is empty. */
  private async runNext(): Promise<string | null> {
    // set inside the transaction callback (a holder, so the type is not narrowed to null here)
    const claim: { id: string | null } = { id: null };
    try {
      return await this.imports.manager.transaction(async (manager) => {
        const rows = await manager.query<Array<{ id: string }>>(
          `SELECT "id" FROM "rate_imports" WHERE "state" = 'queued' ORDER BY "created_at" LIMIT 1 FOR UPDATE SKIP LOCKED`,
        );
        if (rows.length === 0) return null;
        claim.id = rows[0].id;
        const job = await manager.findOneByOrFail(RateImport, {
          id: rows[0].id,
        });
        await finish(manager, job, await this.apply(manager, job));
        return job.id;
      });
    } catch (error: unknown) {
      if (claim.id === null) throw error;
      this.logger.error(
        `Rate import ${claim.id} failed`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.markBroken(claim.id);
      return claim.id;
    }
  }

  private async apply(
    manager: EntityManager,
    job: RateImport,
  ): Promise<Outcome> {
    const kind = IMPORT_RATE_KIND[job.kind];
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `rate_imports:${job.tenantId}:${job.kind}:${job.externalId}`,
    ]);
    if (await newerRevisionApplied(manager, job)) {
      return failed(0, [
        {
          line: 0,
          code: 'stale_revision',
          message: 'a later revision of this document is already applied',
        },
      ]);
    }
    const checked = await validate(manager, job, kind);
    if (checked.errors.length > 0) return failed(checked.total, checked.errors);
    const retired = await retirePrevious(manager, job, kind);
    await insertRows(manager, job, kind, checked.rows);
    await recordImportApplied(
      manager,
      job,
      unique(checked.rows.map((r) => r.profileId)),
    );
    return {
      state: 'completed',
      counts: {
        rows: checked.total,
        inserted: checked.rows.length,
        retired,
        errors: 0,
      },
    };
  }

  /** An unexpected error (not a row error): the document is failed so the queue moves on. */
  private async markBroken(id: string): Promise<void> {
    await this.imports.update(
      { id, state: 'queued' },
      {
        state: 'failed',
        finishedAt: new Date(),
        report: [
          {
            line: 0,
            code: 'internal_error',
            message: 'the import could not be processed',
          },
        ],
      },
    );
  }
}

/** Parsed, resolved rows and every error of the document, by line. */
async function validate(
  manager: EntityManager,
  job: RateImport,
  kind: RateKind,
): Promise<{
  total: number;
  rows: ResolvedImportRow[];
  errors: ImportRowError[];
}> {
  const parsed = parseImport(job.payload, kind === 'sustained');
  const resolved = await resolveImportRows(manager, job.tenantId, parsed.rows);
  const document = { kind, externalId: job.externalId };
  const errors = [
    ...parsed.errors,
    ...resolved.errors,
    ...(await overlapsWithApproved(manager, document, resolved.rows)),
  ].sort((a, b) => a.line - b.line);
  return { total: parsed.total, rows: resolved.rows, errors };
}

function failed(rows: number, report: ImportRowError[]): Outcome {
  return {
    state: 'failed',
    counts: { rows, inserted: 0, retired: 0, errors: report.length },
    report,
  };
}

async function finish(
  manager: EntityManager,
  job: RateImport,
  outcome: Outcome,
): Promise<void> {
  job.state = outcome.state;
  job.counts = outcome.counts;
  job.report = outcome.state === 'failed' ? outcome.report : [];
  job.finishedAt = new Date();
  await manager.save(job);
}

async function newerRevisionApplied(
  manager: EntityManager,
  job: RateImport,
): Promise<boolean> {
  const count = await manager
    .createQueryBuilder(RateImport, 'i')
    .where(
      'i.tenantId = :tenantId AND i.kind = :kind AND i.externalId = :externalId',
      {
        tenantId: job.tenantId,
        kind: job.kind,
        externalId: job.externalId,
      },
    )
    .andWhere(`i.state = 'completed' AND i.revision > :revision`, {
      revision: job.revision,
    })
    .getCount();
  return count > 0;
}

/** Retires the approved rows earlier revisions of the document imported; returns how many. */
async function retirePrevious(
  manager: EntityManager,
  job: RateImport,
  kind: RateKind,
): Promise<number> {
  const result = await manager
    .createQueryBuilder()
    .update(UnitProductRate)
    .set({ state: 'retired', updatedBy: job.importedBy })
    .where(
      `tenant_id = :tenantId AND rate_kind = :kind AND external_id = :externalId AND state = 'approved'`,
      {
        tenantId: job.tenantId,
        kind,
        externalId: job.externalId,
      },
    )
    .execute();
  return result.affected ?? 0;
}

async function insertRows(
  manager: EntityManager,
  job: RateImport,
  kind: RateKind,
  rows: readonly ResolvedImportRow[],
): Promise<void> {
  const versions = await firstVersions(manager, kind, rows);
  const now = new Date();
  const entities = rows.map((row) => {
    const version = versions.get(row.profileId) ?? 1;
    versions.set(row.profileId, version + 1);
    return manager.create(UnitProductRate, {
      tenantId: job.tenantId,
      profileId: row.profileId,
      rateKind: kind,
      rate: row.rate,
      timebase: row.timebase,
      effectiveFrom: row.from,
      effectiveTo: row.to,
      version,
      state: 'approved',
      approvedBy: job.importedBy,
      approvedAt: now,
      source: 'import',
      externalId: job.externalId,
      rateImportId: job.id,
      createdBy: job.importedBy,
      updatedBy: job.importedBy,
    });
  });
  await manager.save(UnitProductRate, entities, { chunk: INSERT_CHUNK });
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/** Next free version per profile for `kind`, taken under each family lock. */
async function firstVersions(
  manager: EntityManager,
  kind: RateKind,
  rows: readonly ResolvedImportRow[],
): Promise<Map<string, number>> {
  const versions = new Map<string, number>();
  for (const profileId of unique(rows.map((r) => r.profileId))) {
    versions.set(
      profileId,
      await nextVersion(manager, UnitProductRate, {
        profileId,
        rateKind: kind,
      }),
    );
  }
  return versions;
}
