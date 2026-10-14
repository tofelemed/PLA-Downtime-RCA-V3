import {
  Check,
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  VersionColumn,
} from 'typeorm';
import { RCA } from '../rca/rca.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('rca_knowledge_base')
@Index(['tenantId'])
@Index(['organizationId'])
@Index(['createdAt'])
// v2 knowledge base (owner decision 2026-10-12): keyset list per tenant, unit / asset filters, one entry per case
@Index('IDX_rca_knowledge_base_tenant_created', ['tenantId', 'createdAt', 'id'])
@Index('IDX_rca_knowledge_base_tenant_unit', ['tenantId', 'unitId'])
@Index('IDX_rca_knowledge_base_tenant_asset', ['tenantId', 'assetId'])
@Index('IDX_rca_knowledge_base_tenant_rca', ['tenantId', 'rcaId'])
/** CA9 shared lessons, newest first (partial, created by the migration) */
@Index('IDX_rca_knowledge_base_shared', { synchronize: false })
@Check('CHK_rca_knowledge_base_share_scope', `"share_scope" IN ('tenant', 'organization')`)
@Check(
  'CHK_rca_knowledge_base_lesson_status',
  `"lesson_status" IS NULL OR "lesson_status" IN ('verified_practice', 'caution', 'unverified')`,
)
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
  @Column({
    name: 'organization_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
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
  @Column({
    name: 'equipment_category',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
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
  @Column({
    name: 'root_cause_category',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  rootCauseCategory?: string;

  @ApiProperty({
    description: 'Contributing factors',
    required: false,
    type: [String],
  })
  @Column({ name: 'contributing_factors', type: 'simple-json', nullable: true })
  contributingFactors?: string[];

  @ApiProperty({
    description: 'Recommendations',
    required: false,
    type: 'array',
  })
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

  @ApiProperty({
    description: 'Related RCA IDs',
    required: false,
    type: [String],
  })
  @Column({ name: 'related_rcas', type: 'simple-json', nullable: true })
  relatedRcas?: string[];

  @ApiProperty({ description: 'Author user ID', required: false })
  @Column({ type: 'varchar', length: 36, nullable: true })
  author?: string;

  @ApiProperty({ description: 'Is published' })
  @Column({ name: 'is_published', type: 'boolean', default: false })
  isPublished: boolean;

  @ApiProperty({
    description:
      'Optimistic concurrency version (If-Match on publish / unpublish)',
  })
  @VersionColumn({ name: 'row_version', default: 1 })
  rowVersion: number;

  @ApiProperty({
    description: 'When the entry was last published',
    required: false,
  })
  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;

  @ApiProperty({ description: 'Who last published the entry', required: false })
  @Column({ name: 'published_by', type: 'varchar', length: 36, nullable: true })
  publishedBy?: string | null;

  @ApiProperty({ description: 'Times referenced' })
  @Column({ name: 'times_referenced', type: 'int', default: 0 })
  timesReferenced: number;

  @ApiProperty({ description: 'Helpful votes (net)' })
  @Column({ name: 'helpful_votes', type: 'int', default: 0 })
  helpfulVotes: number;

  @ApiProperty({ description: 'Closed date ISO string', required: false })
  /** failure mode of the source case's linked events (similarity, CA9 applicability) */
  @Column({
    name: 'failure_mode',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  failureMode?: string | null;

  /** CA9: `tenant` (this plant) or `organization` (published lessons other plants of the organization read) */
  @Column({
    name: 'share_scope',
    type: 'varchar',
    length: 16,
    default: 'tenant',
  })
  shareScope: string;

  @Column({ name: 'shared_by', type: 'uuid', nullable: true })
  sharedBy?: string | null;

  @Column({ name: 'shared_at', type: 'timestamptz', nullable: true })
  sharedAt?: Date | null;

  /** CA9: verified practice (effective), caution (not effective) or unverified, set when the case closes */
  @Column({
    name: 'lesson_status',
    type: 'varchar',
    length: 24,
    nullable: true,
  })
  lessonStatus?: string | null;

  @Column({ name: 'closed_date', type: 'varchar', length: 50, nullable: true })
  closedDate?: string;
}
