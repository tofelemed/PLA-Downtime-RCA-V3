import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('assets')
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'uuid' })
  unitId: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 100 })
  assetType: string;

  @Column({ type: 'varchar', length: 100 })
  criticality: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  manufacturer?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  model?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  serialNumber?: string;

  @Column({ type: 'datetime', nullable: true })
  installationDate?: Date;

  @Column({ type: 'datetime', nullable: true })
  lastMaintenanceDate?: Date;

  @Column({ type: 'datetime', nullable: true })
  nextMaintenanceDate?: Date;

  @Column({ type: 'varchar', length: 100 })
  status: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 