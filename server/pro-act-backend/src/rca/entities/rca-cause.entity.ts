import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantOwnedEntity } from '../../common/entities/tenant-scoped.entity';
import { RCACauseCode } from '../../rca-cause-code/rca-cause-code.entity';
import { RCA } from '../rca.entity';

export const RCA_CAUSE_KINDS = ['direct', 'contributing', 'root'] as const;
export type RcaCauseKind = (typeof RCA_CAUSE_KINDS)[number];

/**
 * A typed cause of an RCA case (item 7): direct, contributing or root, optionally linked to the plant's
 * cause catalogue (`rca_cause_codes`, never deleted while used), with its statement and the evidence
 * items / logic-tree nodes of the case that support it. Coded root causes feed the closure gate of cases
 * under the coded rule and the recurring-cause report. Goes with its case.
 */
@Entity('rca_causes')
@Index('IDX_rca_causes_tenant_rca', ['tenantId', 'rcaId'])
@Index('IDX_rca_causes_tenant_code', ['tenantId', 'causeCodeId'])
@Check('CHK_rca_causes_kind', `"kind" IN ('direct', 'contributing', 'root')`)
export class RcaCause extends TenantOwnedEntity {
  @Column({ name: 'rca_id', type: 'uuid' })
  rcaId: string;

  @ManyToOne(() => RCA, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rca_id', foreignKeyConstraintName: 'FK_rca_causes_rca' })
  rca?: RCA;

  @Column({ name: 'kind', type: 'varchar', length: 16 })
  kind: RcaCauseKind;

  @Column({ name: 'cause_code_id', type: 'uuid', nullable: true })
  causeCodeId: string | null;

  @ManyToOne(() => RCACauseCode, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'cause_code_id',
    foreignKeyConstraintName: 'FK_rca_causes_cause_code',
  })
  causeCode?: RCACauseCode;

  @Column({ name: 'statement', type: 'text' })
  statement: string;

  /** ids of evidence items of the case (`rcas.evidence`) that support the cause */
  @Column({ name: 'evidence_ids', type: 'jsonb', default: () => "'[]'" })
  evidenceIds: string[];

  /** ids of logic-tree nodes of the case (`rcas.logic_tree`) the cause stands for */
  @Column({ name: 'node_ids', type: 'jsonb', default: () => "'[]'" })
  nodeIds: string[];
}
