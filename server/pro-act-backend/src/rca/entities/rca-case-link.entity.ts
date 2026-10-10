import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { RCA } from '../rca.entity';

export const RCA_LINK_TYPES = [
  'event',
  'loss_line',
  'work_order',
  'occurrence',
] as const;
export type RcaLinkType = (typeof RCA_LINK_TYPES)[number];

export const RCA_LINK_SOURCES = ['user', 'trigger', 'migration'] as const;
export type RcaLinkSource = (typeof RCA_LINK_SOURCES)[number];

/**
 * One reference of an RCA case (plan 3.9, RCA02): an event, an approved loss line, a work order or an
 * occurrence, unique per case. `evidence` is the evidence package snapshot taken when the link was made
 * (event revisions, source refs, trend window, cause codes, recurrence, approved impact).
 */
@Entity('rca_case_links')
@Unique('UQ_rca_case_links_target', ['rcaId', 'linkType', 'targetId'])
@Index('IDX_rca_case_links_tenant_target', ['tenantId', 'linkType', 'targetId'])
@Index('IDX_rca_case_links_tenant_rca', ['tenantId', 'rcaId'])
export class RcaCaseLink extends TenantScopedEntity {
  @Column({ name: 'rca_id', type: 'uuid' })
  rcaId: string;

  @ManyToOne(() => RCA, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'rca_id',
    foreignKeyConstraintName: 'FK_rca_case_links_rca',
  })
  rca?: RCA;

  @Column({
    name: 'link_type',
    type: 'enum',
    enum: RCA_LINK_TYPES,
    enumName: 'rca_link_type',
  })
  linkType: RcaLinkType;

  /** event / loss line / occurrence uuid, or the work order number */
  @Column({ name: 'target_id', type: 'varchar', length: 255 })
  targetId: string;

  /** the target's revision when linked (event `row_version`), null when it has none */
  @Column({ name: 'target_revision', type: 'int', nullable: true })
  targetRevision: number | null;

  /** unit of the target (unit-limited readers see links of their units only) */
  @Index('IDX_rca_case_links_unit')
  @Column({ name: 'unit_id', type: 'uuid', nullable: true })
  unitId: string | null;

  @Column({ name: 'source', type: 'varchar', length: 16 })
  source: RcaLinkSource;

  @Column({ name: 'linked_by', type: 'uuid', nullable: true })
  linkedBy: string | null;

  @Column({ name: 'linked_at', type: 'timestamptz' })
  linkedAt: Date;

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'evidence', type: 'jsonb', nullable: true })
  evidence: Record<string, unknown> | null;
}
