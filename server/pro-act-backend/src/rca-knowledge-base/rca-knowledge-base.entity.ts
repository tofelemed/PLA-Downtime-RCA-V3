import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { RCA } from '../rca/rca.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('rca_knowledge_base')
@Index(['tenantId'])
@Index(['organizationId'])
@Index(['createdAt'])
export class RCAKnowledgeBase {
  @ApiProperty({ description: 'Primary key UUID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ApiProperty({ description: 'Tenant ID for multi-tenancy', required: false })
  @Column({ name: 'tenant_id', type: 'varchar', length: 36, nullable: true })
  tenantId?: string;

  @ApiProperty({ description: 'Organization ID', required: false })
  @Column({ name: 'organization_id', type: 'varchar', length: 36, nullable: true })
  organizationId?: string;

  @ApiProperty({ description: 'Source RCA ID' })
  /** The article outlives its source RCA: deleting the RCA clears the link (plan 3.11). */
  @Column({ name: 'rca_id', type: 'uuid', nullable: true })
  rcaId?: string | null;

  @ManyToOne(() => RCA, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'rca_id' })
  rca?: RCA;

  @ApiProperty({ description: 'Article title' })
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @ApiProperty({ description: 'Detailed description', required: false })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @ApiProperty({ description: 'Problem statement', required: false })
  @Column({ name: 'problem_statement', type: 'text', nullable: true })
  problemStatement?: string;

  @ApiProperty({ description: 'Event type', required: false })
  @Column({ name: 'event_type', type: 'varchar', length: 100, nullable: true })
  eventType?: string;

  @ApiProperty({ description: 'Associated unit ID', required: false })
  @Column({ name: 'unit_id', type: 'varchar', length: 36, nullable: true })
  unitId?: string;

  @ApiProperty({ description: 'Associated unit name', required: false })
  @Column({ name: 'unit_name', type: 'varchar', length: 255, nullable: true })
  unitName?: string;

  @ApiProperty({ description: 'Associated asset ID', required: false })
  @Column({ name: 'asset_id', type: 'varchar', length: 36, nullable: true })
  assetId?: string;

  @ApiProperty({ description: 'Associated asset name', required: false })
  @Column({ name: 'asset_name', type: 'varchar', length: 255, nullable: true })
  assetName?: string;

  @ApiProperty({ description: 'Equipment category', required: false })
  @Column({ name: 'equipment_category', type: 'varchar', length: 150, nullable: true })
  equipmentCategory?: string;

  @ApiProperty({ description: 'Category', required: false })
  @Column({ type: 'varchar', length: 100, nullable: true })
  category?: string;

  @ApiProperty({ description: 'Symptoms', required: false, type: [String] })
  @Column({ type: 'simple-json', nullable: true })
  symptoms?: string[];

  @ApiProperty({ description: 'Impact codes', required: false, type: [String] })
  @Column({ name: 'impact_codes', type: 'simple-json', nullable: true })
  impactCodes?: string[];

  @ApiProperty({ description: 'OEE codes', required: false, type: [String] })
  @Column({ name: 'oee_codes', type: 'simple-json', nullable: true })
  oeeCodes?: string[];

  @ApiProperty({ description: 'Root cause', required: false })
  @Column({ name: 'root_cause', type: 'text', nullable: true })
  rootCause?: string;

  @ApiProperty({ description: 'Root cause category', required: false })
  @Column({ name: 'root_cause_category', type: 'varchar', length: 150, nullable: true })
  rootCauseCategory?: string;

  @ApiProperty({ description: 'Contributing factors', required: false, type: [String] })
  @Column({ name: 'contributing_factors', type: 'simple-json', nullable: true })
  contributingFactors?: string[];

  @ApiProperty({ description: 'Recommendations', required: false, type: 'array' })
  @Column({ type: 'simple-json', nullable: true })
  recommendations?: any[];

  @ApiProperty({ description: 'Recurrence count' })
  @Column({ name: 'recurrence_count', type: 'int', default: 0 })
  recurrenceCount: number;

  @ApiProperty({ description: 'Effectiveness score' })
  @Column({ type: 'float', default: 0 })
  effectiveness: number;

  @ApiProperty({ description: 'Cost saved', required: false })
  @Column({ name: 'cost_saved', type: 'float', nullable: true })
  costSaved?: number;

  @ApiProperty({ description: 'Downtime reduced (minutes)', required: false })
  @Column({ name: 'downtime_reduced', type: 'float', nullable: true })
  downtimeReduced?: number;

  @ApiProperty({ description: 'Keywords', required: false, type: [String] })
  @Column({ type: 'simple-json', nullable: true })
  keywords?: string[];

  @ApiProperty({ description: 'Tags', required: false, type: [String] })
  @Column({ type: 'simple-json', nullable: true })
  tags?: string[];

  @ApiProperty({ description: 'Article content', required: false })
  @Column({ type: 'text', nullable: true })
  content?: string;

  @ApiProperty({ description: 'Related RCA IDs', required: false, type: [String] })
  @Column({ name: 'related_rcas', type: 'simple-json', nullable: true })
  relatedRcas?: string[];

  @ApiProperty({ description: 'Author user ID', required: false })
  @Column({ type: 'varchar', length: 36, nullable: true })
  author?: string;

  @ApiProperty({ description: 'Is published' })
  @Column({ name: 'is_published', type: 'boolean', default: false })
  isPublished: boolean;

  @ApiProperty({ description: 'Times referenced' })
  @Column({ name: 'times_referenced', type: 'int', default: 0 })
  timesReferenced: number;

  @ApiProperty({ description: 'Helpful votes (net)' })
  @Column({ name: 'helpful_votes', type: 'int', default: 0 })
  helpfulVotes: number;

  @ApiProperty({ description: 'Closed date ISO string', required: false })
  @Column({ name: 'closed_date', type: 'varchar', length: 50, nullable: true })
  closedDate?: string;
}

