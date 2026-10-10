import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MigrationReport } from './migration-report.entity';

/**
 * Row-level audit trail of an applied run (plan 3.10): the column values before and after each update
 * or insert, in apply order (`seq`). A revert walks them backwards and refuses when a row no longer
 * holds the `after` values (changed since the run).
 */
@Entity('migration_changes')
@Index('IDX_migration_changes_report', ['reportId', 'seq'])
export class MigrationChange {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'report_id', type: 'uuid' })
  reportId: string;

  @ManyToOne(() => MigrationReport, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'report_id',
    foreignKeyConstraintName: 'FK_migration_changes_report',
  })
  report?: MigrationReport;

  @Column({ name: 'seq', type: 'int' })
  seq: number;

  @Column({ name: 'kind', type: 'varchar', length: 8 })
  kind: 'update' | 'insert';

  @Column({ name: 'table_name', type: 'varchar', length: 64 })
  tableName: string;

  @Column({ name: 'row_id', type: 'uuid' })
  rowId: string;

  @Column({ name: 'before', type: 'jsonb', nullable: true })
  before: Record<string, unknown> | null;

  @Column({ name: 'after', type: 'jsonb' })
  after: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
