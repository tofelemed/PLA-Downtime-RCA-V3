import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Cutover write freeze of a tenant's v1 routes (spec MIG05 step 1): while a row has no `released_at`,
 * every v1 POST / PUT / PATCH / DELETE of that tenant answers 423 `LEGACY_WRITES_FROZEN`. Rows are kept
 * after release (history); at most one active freeze per tenant.
 */
@Entity('legacy_write_freezes')
@Index('UQ_legacy_write_freezes_active', ['tenantId'], {
  unique: true,
  where: '"released_at" IS NULL',
})
export class LegacyWriteFreeze {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'reason', type: 'text' })
  reason: string;

  @Column({ name: 'frozen_by', type: 'varchar', length: 255 })
  frozenBy: string;

  @Column({ name: 'frozen_at', type: 'timestamptz' })
  frozenAt: Date;

  @Column({ name: 'released_at', type: 'timestamptz', nullable: true })
  releasedAt: Date | null;

  @Column({ name: 'released_by', type: 'varchar', length: 255, nullable: true })
  releasedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
