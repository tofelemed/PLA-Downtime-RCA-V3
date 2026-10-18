import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import {
  CauseField,
  CauseValues,
  SuggestionReason,
} from '../../domain/events/stop-reconciliation';
import { ProductionEvent } from '../../production-event/production-event.entity';

export const RECONCILIATION_STATES = [
  'suggested',
  'merged',
  'rejected',
  'undone',
  'expired',
] as const;
export type ReconciliationState = (typeof RECONCILIATION_STATES)[number];

export const RECONCILIATION_MODES = ['auto', 'manual'] as const;
export type ReconciliationMode = (typeof RECONCILIATION_MODES)[number];

/**
 * DT-04 / SME D5 duplicate merge (plan 1.10 SRC02): one stop recorded twice — e.g. manual and PI, or PI and
 * the state engine. `merged`: the evidence event is superseded by the kept (authoritative-timing) event,
 * linked `correlated_with`, shares its occurrence, and filled the kept event's empty cause fields
 * (`copied`); reversible (`undone` restores both). `suggested`: a person decides (same source, cause
 * conflict, ambiguous match); `rejected` / `undone` pairs are never proposed again; `expired` = the
 * suggestion no longer matches. Every decision is also a revision of the events (audited).
 */
@Entity('stop_reconciliations')
@Index('IDX_approval_inbox_stop_reconciliations', { synchronize: false })
@Index(
  'UQ_stop_reconciliations_pair',
  ['tenantId', 'keptEventId', 'evidenceEventId'],
  { unique: true },
)
@Index('IDX_stop_reconciliations_tenant_unit_state', [
  'tenantId',
  'unitId',
  'state',
])
@Index('IDX_stop_reconciliations_tenant_evidence', [
  'tenantId',
  'evidenceEventId',
])
@Check(
  'CHK_stop_reconciliations_state',
  `"state" IN ('suggested', 'merged', 'rejected', 'undone', 'expired')`,
)
@Check('CHK_stop_reconciliations_mode', `"mode" IN ('auto', 'manual')`)
@Check(
  'CHK_stop_reconciliations_not_self',
  '"kept_event_id" <> "evidence_event_id"',
)
export class StopReconciliation extends TenantScopedEntity {
  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  /** the stop of the best timing authority, which stays live */
  @Column({ name: 'kept_event_id', type: 'uuid' })
  keptEventId: string;

  @ManyToOne(() => ProductionEvent, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'kept_event_id',
    foreignKeyConstraintName: 'FK_stop_reconciliations_kept_event',
  })
  keptEvent?: ProductionEvent;

  /** the duplicate, kept as evidence (superseded while merged) */
  @Column({ name: 'evidence_event_id', type: 'uuid' })
  evidenceEventId: string;

  @ManyToOne(() => ProductionEvent, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'evidence_event_id',
    foreignKeyConstraintName: 'FK_stop_reconciliations_evidence_event',
  })
  evidenceEvent?: ProductionEvent;

  @Column({ name: 'state', type: 'varchar', length: 16 })
  state: ReconciliationState;

  /** auto = merged by the policy; manual = a person accepted a suggestion */
  @Column({ name: 'mode', type: 'varchar', length: 16 })
  mode: ReconciliationMode;

  @Column({
    name: 'suggestion_reason',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  suggestionReason: SuggestionReason | null;

  @Column({
    name: 'start_delta_seconds',
    type: 'numeric',
    precision: 18,
    scale: 3,
  })
  startDeltaSeconds: number;

  @Column({
    name: 'end_delta_seconds',
    type: 'numeric',
    precision: 18,
    scale: 3,
    nullable: true,
  })
  endDeltaSeconds: number | null;

  /** the policy's merge tolerance the match used */
  @Column({ name: 'tolerance_seconds', type: 'int' })
  toleranceSeconds: number;

  @Column({ name: 'conflicts', type: 'jsonb', default: () => "'[]'" })
  conflicts: CauseField[];

  /** cause values copied onto the kept event by the merge (reverted on undo while unchanged) */
  @Column({ name: 'copied', type: 'jsonb', default: () => "'{}'" })
  copied: CauseValues;

  /** the evidence event's occurrence before the merge (restored on undo) */
  @Column({ name: 'evidence_occurrence_id', type: 'uuid', nullable: true })
  evidenceOccurrenceId: string | null;

  /** `oee_policy` version whose tolerance applied */
  @Column({ name: 'policy_version_id', type: 'uuid', nullable: true })
  policyVersionId: string | null;

  @Column({ name: 'decided_by', type: 'uuid', nullable: true })
  decidedBy: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ name: 'decision_reason', type: 'text', nullable: true })
  decisionReason: string | null;
}
