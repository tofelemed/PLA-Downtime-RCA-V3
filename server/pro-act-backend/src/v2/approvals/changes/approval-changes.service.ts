import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AccountingPoliciesService } from '../../../periods/accounting-policies.service';
import { ChangeField, ChangeSet, ChangeSource } from './change-types';
import { loadFamilyChanges } from './family-changes';
import { changeSetOf, headlineOf } from './field-diff';
import { withNames } from './name-refs';
import { loadRecordChanges, loadStopMergeChanges } from './record-changes';
import { loadPeriodChanges, loadProposalChanges } from './review-changes';
import { VERSION_CHANGE_KINDS } from './version-changes';
import { loadRuleChanges, WORKFLOW_CHANGE_KINDS } from './workflow-changes';

const FAMILY_KINDS = { ...VERSION_CHANGE_KINDS, ...WORKFLOW_CHANGE_KINDS };
const MONTH_KINDS = new Set([
  'month-materiality',
  'month-finance',
  'month-lock',
]);
/**
 * Kinds whose figures come from the reviewed content of a revision (two full revision loads): read on the
 * approval page only; inbox rows keep their summary (no recalculation per row of a list).
 */
const DETAIL_ONLY = new Set(['period-review', 'finance-posting']);

/**
 * "Exactly the value needing approval": per pending record the field-level change against its approved /
 * effective predecessor (or the full pending content when it has none). Read-only; the caller has already
 * limited the ids to records pending in its approval scope.
 */
@Injectable()
export class ApprovalChangesService {
  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly policies: AccountingPoliciesService,
  ) {}

  /** Change sets of pending records of one kind (a bounded number of queries for every id). */
  async changesOf(
    tenantId: string,
    kind: string,
    ids: readonly string[],
  ): Promise<Map<string, ChangeSet>> {
    if (ids.length === 0) return new Map();
    const sources = await withNames(
      this.manager,
      tenantId,
      await this.sourcesOf(tenantId, kind, ids),
    );
    return new Map(sources.map((source) => [source.id, changeSetOf(source)]));
  }

  /** The one-line change of each inbox row; empty for the kinds read on the approval page only. */
  async headlinesOf(
    tenantId: string,
    kind: string,
    ids: readonly string[],
  ): Promise<Map<string, ChangeField | null>> {
    if (DETAIL_ONLY.has(kind)) return new Map();
    const sets = await this.changesOf(tenantId, kind, ids);
    return new Map([...sets].map(([id, set]) => [id, headlineOf(set)]));
  }

  private sourcesOf(
    tenantId: string,
    kind: string,
    ids: readonly string[],
  ): Promise<ChangeSource[]> {
    const family = FAMILY_KINDS[kind];
    if (family) return loadFamilyChanges(this.manager, family, tenantId, ids);
    if (kind === 'rule') return loadRuleChanges(this.manager, tenantId, ids);
    if (DETAIL_ONLY.has(kind))
      return loadPeriodChanges(this.manager, this.policies, tenantId, ids);
    if (kind === 'change-proposal')
      return loadProposalChanges(this.manager, tenantId, ids);
    if (kind === 'rca-closure')
      return loadRecordChanges(this.manager, 'rca-closure', tenantId, ids);
    if (MONTH_KINDS.has(kind))
      return loadRecordChanges(this.manager, 'month', tenantId, ids);
    if (kind === 'stop-merge')
      return loadStopMergeChanges(this.manager, tenantId, ids);
    return Promise.resolve([]);
  }
}
