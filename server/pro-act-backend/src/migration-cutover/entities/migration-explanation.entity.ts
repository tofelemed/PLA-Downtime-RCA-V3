import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export const EXPLANATION_CATEGORIES = [
  'formula_change',
  'quality_change',
  'defect',
] as const;
export type ExplanationCategory = (typeof EXPLANATION_CATEGORIES)[number];

/**
 * Why a MIG04 comparison value differs between v1 and v2 (plan 3.10 parallel run). It explains the
 * pair of values it was written for: once either side moves, the difference counts as unexplained
 * again. Never a balancing adjustment — nothing here changes an accounting figure.
 */
@Entity('migration_explanations')
@Index('IDX_migration_explanations_lookup', ['tenantId', 'metric', 'scopeKey'])
@Check(
  'CHK_migration_explanations_category',
  `"category" IN ('formula_change', 'quality_change', 'defect')`,
)
export class MigrationExplanation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'metric', type: 'varchar', length: 64 })
  metric: string;

  @Column({ name: 'scope_key', type: 'varchar', length: 255 })
  scopeKey: string;

  @Column({
    name: 'legacy_value',
    type: 'numeric',
    precision: 24,
    scale: 8,
    nullable: true,
  })
  legacyValue: number | null;

  @Column({
    name: 'v2_value',
    type: 'numeric',
    precision: 24,
    scale: 8,
    nullable: true,
  })
  v2Value: number | null;

  @Column({ name: 'category', type: 'varchar', length: 32 })
  category: ExplanationCategory;

  @Column({ name: 'note', type: 'text' })
  note: string;

  @Column({ name: 'author', type: 'varchar', length: 255 })
  author: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
