import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { DataBinding } from './data-binding.entity';

@Entity('data_transformations')
export class DataTransformation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  bindingId: string;

  @Column({ type: 'varchar', length: 50 })
  transformationType: string; // 'scale', 'offset', 'formula', 'lookup', 'filter', etc.

  @Column({ type: 'simple-json', nullable: true })
  parameters: any; // Transformation-specific parameters

  @Column({ type: 'int', default: 0 })
  orderIndex: number;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string;

  @Column({ type: 'simple-json', nullable: true })
  inputMapping: any; // Input field mapping

  @Column({ type: 'simple-json', nullable: true })
  outputMapping: any; // Output field mapping

  @Column({ type: 'varchar', length: 1000, nullable: true })
  formula: string; // Mathematical formula for calculations

  @Column({ type: 'simple-json', nullable: true })
  conditions: any; // Conditional logic for transformations

  @ManyToOne(() => DataBinding, binding => binding.transformations, { onDelete: 'CASCADE' })
  binding: DataBinding;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
