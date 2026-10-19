import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { assertRevision } from '../common/concurrency/revision';
import { RequestContext } from '../common/context/request-context';
import { RcaCause, RcaCauseKind } from '../rca/entities/rca-cause.entity';
import { RCA } from '../rca/rca.entity';
import {
  RcaCaseCauseV2CreateDto,
  RcaCaseCauseV2UpdateDto,
} from '../v2/rca/rca-case-causes-v2.dto';
import {
  assertCaseItems,
  assertCauseCode,
  assertCausesOpen,
  causeColumns,
} from './cause-rules';
import { childAudit, recordRcaAudit } from './rca-audit';
import { findCase, notFound, RcaScope, scopeOf } from './rca-scope';
import { assertCaseNotClosed } from './case-closed';

export interface RcaCaseCauseV2View {
  id: string;
  rcaId: string;
  kind: RcaCauseKind;
  causeCodeId: string | null;
  /** the catalogue entry (null without a code); `active` false once it was retired */
  causeCode: { code: string; name: string; active: boolean } | null;
  statement: string;
  evidenceIds: string[];
  nodeIds: string[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

type CodeNames = ReadonlyMap<
  string,
  { code: string; name: string; active: boolean }
>;

function toCauseView(cause: RcaCause, codes: CodeNames): RcaCaseCauseV2View {
  return {
    id: cause.id,
    rcaId: cause.rcaId,
    kind: cause.kind,
    causeCodeId: cause.causeCodeId,
    causeCode: cause.causeCodeId
      ? (codes.get(cause.causeCodeId) ?? null)
      : null,
    statement: cause.statement,
    evidenceIds: cause.evidenceIds ?? [],
    nodeIds: cause.nodeIds ?? [],
    createdBy: cause.createdBy,
    createdAt: cause.createdAt.toISOString(),
    updatedAt: cause.updatedAt.toISOString(),
    rowVersion: cause.rowVersion,
  };
}

type Target = { id: string; expectedRowVersion: number };

/**
 * Typed causes of a case (item 7): direct, contributing and root causes linked to the plant's cause
 * catalogue, with the case's evidence items and logic-tree nodes that support them. Written by RCA
 * writers in the case's scope until closure is requested (422 CAUSES_LOCKED), If-Match on changes, a
 * retired catalogue cause is never newly assigned (422 CAUSE_CODE_RETIRED). Every write is audited.
 */
@Injectable()
export class RcaCausesService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async list(
    context: RequestContext,
    rcaId: string,
  ): Promise<RcaCaseCauseV2View[]> {
    const scope = scopeOf(context);
    const manager = this.dataSource.manager;
    await findCase(manager, scope, rcaId);
    const rows = await manager.getRepository(RcaCause).find({
      where: { tenantId: scope.tenantId, rcaId },
      order: { createdAt: 'ASC', id: 'ASC' },
      take: 200,
    });
    return this.views(manager, rows);
  }

  create(
    context: RequestContext,
    rcaId: string,
    body: RcaCaseCauseV2CreateDto,
  ): Promise<RcaCaseCauseV2View> {
    const scope = scopeOf(context);
    return this.dataSource.transaction(async (manager) => {
      const rca = await findCase(manager, scope, rcaId, true);
      assertCaseNotClosed(rca);
      assertCausesOpen(rca);
      const columns = causeColumns(body);
      await this.assertValid(manager, rca, { columns, current: null });
      const repository = manager.getRepository(RcaCause);
      const saved = await repository.save(
        repository.create({
          evidenceIds: [],
          nodeIds: [],
          causeCodeId: null,
          ...columns,
          tenantId: scope.tenantId,
          rcaId,
          createdBy: scope.userId,
        }),
      );
      await recordRcaAudit(manager, scope, [
        childAudit('rca_cause', 'created', { before: null, after: saved }),
      ]);
      return (await this.views(manager, [saved]))[0];
    });
  }

  update(
    context: RequestContext,
    target: Target,
    body: RcaCaseCauseV2UpdateDto,
  ): Promise<RcaCaseCauseV2View> {
    const scope = scopeOf(context);
    return this.dataSource.transaction(async (manager) => {
      const { cause, rca } = await this.lockCause(manager, scope, target);
      const columns = causeColumns(body);
      await this.assertValid(manager, rca, { columns, current: cause });
      const saved = await manager
        .getRepository(RcaCause)
        .save({ ...cause, ...columns, updatedBy: scope.userId });
      await recordRcaAudit(manager, scope, [
        childAudit('rca_cause', 'updated', { before: cause, after: saved }),
      ]);
      return (await this.views(manager, [saved]))[0];
    });
  }

  async remove(context: RequestContext, target: Target): Promise<void> {
    const scope = scopeOf(context);
    await this.dataSource.transaction(async (manager) => {
      const { cause } = await this.lockCause(manager, scope, target);
      await manager
        .getRepository(RcaCause)
        .delete({ id: cause.id, tenantId: scope.tenantId });
      await recordRcaAudit(manager, scope, [
        childAudit('rca_cause', 'deleted', { before: cause, after: null }),
      ]);
    });
  }

  private async assertValid(
    manager: EntityManager,
    rca: RCA,
    input: { columns: Partial<RcaCause>; current: RcaCause | null },
  ): Promise<void> {
    const { columns, current } = input;
    await assertCauseCode(manager, rca.tenantId ?? '', {
      next: columns.causeCodeId,
      current: current?.causeCodeId ?? null,
    });
    assertCaseItems(rca, {
      evidenceIds: columns.evidenceIds ?? [],
      nodeIds: columns.nodeIds ?? [],
    });
  }

  /** A cause of the caller's scope, locked, of an editable case, at the expected version (404 / 422 / 412). */
  private async lockCause(
    manager: EntityManager,
    scope: RcaScope,
    target: Target,
  ): Promise<{ cause: RcaCause; rca: RCA }> {
    const cause = await manager
      .getRepository(RcaCause)
      .createQueryBuilder('c')
      .setLock('pessimistic_write')
      .where('c.id = :id AND c.tenantId = :tenantId', {
        id: target.id,
        tenantId: scope.tenantId,
      })
      .getOne();
    if (!cause) throw notFound('RCA cause');
    const rca = await findCase(manager, scope, cause.rcaId, true).catch(() => {
      throw notFound('RCA cause');
    });
    assertCaseNotClosed(rca);
    assertRevision(cause.rowVersion, target.expectedRowVersion);
    assertCausesOpen(rca);
    return { cause, rca };
  }

  private async views(
    manager: EntityManager,
    rows: readonly RcaCause[],
  ): Promise<RcaCaseCauseV2View[]> {
    const ids = [
      ...new Set(
        rows.flatMap((row) => (row.causeCodeId ? [row.causeCodeId] : [])),
      ),
    ];
    const codes: Array<{
      id: string;
      code: string;
      name: string;
      is_active: boolean;
    }> =
      ids.length === 0
        ? []
        : await manager.query(
            `SELECT "id", "code", "name", "is_active" FROM "rca_cause_codes" WHERE "id" = ANY($1::uuid[])`,
            [ids],
          );
    const names = new Map(
      codes.map((c) => [
        c.id,
        { code: c.code, name: c.name, active: c.is_active },
      ]),
    );
    return rows.map((row) => toCauseView(row, names));
  }
}
