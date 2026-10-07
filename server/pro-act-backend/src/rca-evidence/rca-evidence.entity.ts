import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { RCA } from '../rca/rca.entity';

@Entity('rca_evidence')
export class RCAEvidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  rcaId: string;
  @ManyToOne(() => RCA)
  @JoinColumn({ name: 'rcaId' })
  rca: RCA;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 50 })
  type: string; // Photo, Document, Time Series, Note, Video

  @Column({ type: 'varchar', length: 255, nullable: true })
  fileName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  filePath: string;

  @Column({ type: 'varchar', length: 255 })
  collectedBy: string;

  @Column({ type: 'timestamptz' })
  collectedAt: Date;

  @Column({ type: 'simple-array', nullable: true })
  nodeIds: string[];

  @Column({ type: 'bytea', nullable: true })
  fileBlob: Buffer;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  location: string;

  @Column({ type: 'timestamptz', nullable: true })
  timestamp: Date;

  @Column({ type: 'uuid', nullable: true })
  relatedAssetId: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  severity: string;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ type: 'boolean', nullable: true })
  verified: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  fiveP: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  task: string;

  @Column({ type: 'timestamptz', nullable: true })
  dueDate: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  status: string;

  @Column({ type: 'simple-json', nullable: true })
  attachments: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 