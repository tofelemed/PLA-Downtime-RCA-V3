import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { RCA } from '../rca/rca.entity';
import { User } from '../users/user.entity';

@Entity('rca_recommendations')
export class RCARecommendation {
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
  priority: string; // Low, Medium, High

  @Column({ type: 'uuid' })
  assigneeId: string;
  @ManyToOne(() => User)
  @JoinColumn({ name: 'assigneeId' })
  assignee: User;

  @Column({ type: 'timestamptz', nullable: true })
  dueDate: Date;

  @Column({ type: 'varchar', length: 50 })
  status: string; // Open, In Progress, Completed, Cancelled

  @Column({ type: 'varchar', length: 255, nullable: true })
  cmmsWorkOrderId: string;

  @Column({ type: 'float', nullable: true })
  estimatedCost: number;

  @Column({ type: 'float', nullable: true })
  actualCost: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 