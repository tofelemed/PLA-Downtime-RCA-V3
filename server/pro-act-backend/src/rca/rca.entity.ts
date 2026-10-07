import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { ProductionEvent } from '../production-event/production-event.entity';
import { User } from '../users/user.entity';
import { RCATemplate } from '../rca-template/rca-template.entity';

@Entity('rcas')
export class RCA {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', type: 'uuid', nullable: true })
  eventId?: string;

  @ManyToOne(() => ProductionEvent)
  @JoinColumn({ name: 'event_id' })
  event?: ProductionEvent;

  @Column({ name: 'title', type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'status', type: 'varchar', length: 50, nullable: true })
  status?: string; // Draft, In Progress, Analysis, Published, Closed

  @Column({ name: 'team_lead_id', type: 'uuid', nullable: true })
  teamLeadId?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'team_lead_id' })
  teamLead?: User;

  @Column({ name: 'team_members', type: 'text', nullable: true })
  teamMemberIds?: string[]; // Stored as JSON string in DB

  @Column({ name: 'priority', type: 'varchar', length: 50, nullable: true })
  priority?: string; // Low, Medium, High, Critical

  @Column({ name: 'target_completion_date', type: 'timestamptz', nullable: true })
  targetCloseDate?: Date;

  @Column({ name: 'actual_completion_date', type: 'timestamptz', nullable: true })
  actualCloseDate?: Date;

  @Column({ name: 'root_cause', type: 'text', nullable: true })
  rootCause?: string;

  @Column({ name: 'recommendations', type: 'text', nullable: true })
  recommendations?: string;

  @Column({ name: 'logic_tree', type: 'text', nullable: true })
  logicTree?: string;

  @Column({ name: 'evidence', type: 'text', nullable: true })
  evidence?: string;

  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  templateId?: string;

  @ManyToOne(() => RCATemplate)
  @JoinColumn({ name: 'template_id' })
  template?: RCATemplate;

  @Column({ name: 'team_charter', type: 'text', nullable: true })
  teamCharter?: string;

  @Column({ name: 'event_diagram', type: 'text', nullable: true })
  eventDiagram?: string;

  @Column({ name: 'pre_failure_rate', type: 'decimal', precision: 5, scale: 2, nullable: true })
  preFailureRate?: number;

  @Column({ name: 'post_failure_rate', type: 'decimal', precision: 5, scale: 2, nullable: true })
  postFailureRate?: number;

  @Column({ name: 'failure_cost_per_incident', type: 'decimal', precision: 10, scale: 2, nullable: true })
  failureCostPerIncident?: number;

  @Column({ name: 'implementation_cost', type: 'decimal', precision: 10, scale: 2, nullable: true })
  implementationCost?: number;

  @Column({ name: 'time_to_resolution', type: 'decimal', precision: 10, scale: 2, nullable: true })
  timeToResolution?: number;

  @Column({ name: 'time_to_implementation', type: 'decimal', precision: 10, scale: 2, nullable: true })
  timeToImplementation?: number;

  @Column({ name: 'effectiveness_score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  effectivenessScore?: number;

  @Column({ name: 'last_updated', type: 'timestamptz', nullable: true })
  lastUpdated?: Date;

  @Column({ name: 'tracking_notes', type: 'text', nullable: true })
  trackingNotes?: string;

  @Column({ name: 'phase_timeline', type: 'text', nullable: true })
  phaseTimeline?: string;

  @Column({ name: 'calculated_roi', type: 'decimal', precision: 10, scale: 2, nullable: true })
  calculatedROI?: number;

  @Column({ name: 'cost_savings', type: 'decimal', precision: 10, scale: 2, nullable: true })
  costSavings?: number;

  @Column({ name: 'downtime_reduction', type: 'decimal', precision: 5, scale: 2, nullable: true })
  downtimeReduction?: number;

  @Column({ name: 'productivity_improvement', type: 'decimal', precision: 5, scale: 2, nullable: true })
  productivityImprovement?: number;

  @Column({ name: 'tenant_id', type: 'varchar', length: 36, nullable: true })
  tenantId?: string;

  @Column({ name: 'organization_id', type: 'varchar', length: 36, nullable: true })
  organizationId?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => ProductionEvent, event => event.rca)
  events: ProductionEvent[];
} 