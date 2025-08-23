import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { ProductionEvent } from '../production-event/production-event.entity';
import { User } from '../users/user.entity';
import { RCATemplate } from '../rca-template/rca-template.entity';

@Entity('rcas')
export class RCA {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  eventId: string;

  @ManyToOne(() => ProductionEvent)
  @JoinColumn({ name: 'eventId' })
  event: ProductionEvent;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 50 })
  status: string; // Draft, In Progress, Analysis, Published, Closed

  @Column({ type: 'uuid' })
  teamLeadId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'teamLeadId' })
  teamLead: User;

  @Column({ type: 'simple-array' })
  teamMemberIds: string[];

  @Column({ type: 'varchar', length: 50 })
  priority: string; // Low, Medium, High, Critical

  @Column({ type: 'datetime', nullable: true })
  targetCloseDate: Date;

  @Column({ type: 'datetime', nullable: true })
  actualCloseDate: Date;

  @Column({ type: 'text', nullable: true })
  rootCause: string;

  @Column({ type: 'nvarchar', length: 'max' })
  recommendations: string;

  @Column({ type: 'nvarchar', length: 'max', nullable: true })
  logicTree: string;

  @Column({ type: 'nvarchar', length: 'max' })
  evidence: string;

  @Column({ type: 'uuid', nullable: true })
  templateId: string;

  @ManyToOne(() => RCATemplate)
  @JoinColumn({ name: 'templateId' })
  template: RCATemplate;

  @Column({ type: 'text', nullable: true })
  teamCharter: string;

  @Column({ type: 'nvarchar', length: 'max', nullable: true })
  eventDiagram: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  preFailureRate: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  postFailureRate: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  failureCostPerIncident: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  implementationCost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  timeToResolution: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  timeToImplementation: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  effectivenessScore: number;

  @Column({ type: 'datetime', nullable: true })
  lastUpdated: Date;

  @Column({ type: 'text', nullable: true })
  trackingNotes: string;

  @Column({ type: 'nvarchar', length: 'max', nullable: true })
  phaseTimeline: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  calculatedROI: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  costSavings: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  downtimeReduction: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  productivityImprovement: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ProductionEvent, event => event.rca)
  events: ProductionEvent[];
} 