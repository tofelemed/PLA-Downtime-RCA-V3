import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('stream_processors')
@Index(['tenantId'])
@Index(['organizationId'])
@Index(['type'])
@Index(['enabled'])
@Index(['order'])
export class StreamProcessorEntity {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  type: string;

  @Column({ type: 'simple-json', nullable: true })
  config?: Record<string, any>;

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: 'int', default: 0 })
  order: number;

  @Column({ type: 'simple-json', nullable: true })
  inputSchema?: Record<string, any>;

  @Column({ type: 'simple-json', nullable: true })
  outputSchema?: Record<string, any>;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'varchar', length: 36, nullable: true })
  tenantId?: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  organizationId?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}


