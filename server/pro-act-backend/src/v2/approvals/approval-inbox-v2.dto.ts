import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
export class ApprovalInboxQueryDto {
  @ApiPropertyOptional({ maxLength: 1024 })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  cursor?: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
  @ApiPropertyOptional({
    description: 'Exact workflow kind returned by an inbox row',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  kind?: string;
  @ApiPropertyOptional({
    enum: ['true', 'false'],
    description:
      'Only records the caller may decide (the requester rule applied; the decision command still decides)',
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  decidable?: 'true' | 'false';
}
export class ApprovalActionView {
  @ApiProperty({ enum: ['approve', 'retire', 'reject', 'return', 'activate'] })
  action: string;
  @ApiProperty({ nullable: true, type: String }) disabledReason: string | null;
}
export const CHANGE_FORMATS = [
  'text',
  'number',
  'quantity',
  'money',
  'instant',
  'date',
  'boolean',
  'duration',
] as const;
export class ApprovalChangeFieldView {
  @ApiProperty() key: string;
  @ApiProperty() label: string;
  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'Value of the approved / effective predecessor (null without one)',
  })
  before: string | null;
  @ApiProperty({ nullable: true, type: String, description: 'Pending value' })
  after: string | null;
  @ApiProperty({ nullable: true, type: String }) unit: string | null;
  @ApiProperty({ nullable: true, type: String }) currency: string | null;
  @ApiProperty({ enum: CHANGE_FORMATS }) format: string;
  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'Money values of one figure in several currencies share a group',
  })
  group: string | null;
  @ApiProperty() changed: boolean;
}
export class ApprovalChangesView {
  @ApiProperty() kind: string;
  @ApiProperty() id: string;
  @ApiProperty({
    enum: ['diff', 'full', 'compare'],
    description:
      'diff: against the approved / effective predecessor; full: no predecessor, the pending content; compare: two records side by side',
  })
  mode: string;
  @ApiProperty({ nullable: true, type: String }) beforeLabel: string | null;
  @ApiProperty() afterLabel: string;
  @ApiProperty({ type: [ApprovalChangeFieldView] })
  fields: ApprovalChangeFieldView[];
}
export class ApprovalTargetView {
  @ApiProperty({ nullable: true, type: String }) periodId: string | null;
  @ApiProperty({ nullable: true, type: String }) planId: string | null;
  @ApiProperty({ nullable: true, type: Number }) revision: number | null;
  @ApiProperty({ nullable: true, type: String }) monthKey: string | null;
  @ApiProperty({ nullable: true, type: String }) eventId: string | null;
  @ApiProperty({ nullable: true, type: String }) profileId: string | null;
}
export class ApprovalItemView {
  @ApiProperty() id: string;
  @ApiProperty() kind: string;
  @ApiProperty() kindLabel: string;
  @ApiProperty() title: string;
  @ApiProperty() summary: string;
  @ApiProperty() state: string;
  @ApiProperty() createdAt: string;
  @ApiProperty({ nullable: true, type: String }) unitId: string | null;
  @ApiProperty({ nullable: true, type: String }) unitName: string | null;
  @ApiProperty({ nullable: true, type: String }) authorId: string | null;
  @ApiProperty({ nullable: true, type: String }) authorName: string | null;
  @ApiProperty({ type: [String] }) requiredRoles: string[];
  @ApiProperty() reviewHref: string;
  @ApiProperty({ nullable: true, type: String }) resource: string | null;
  @ApiProperty() commandId: string;
  @ApiProperty({ nullable: true, type: Number }) version: number | null;
  @ApiProperty() rowVersion: number;
  @ApiProperty() supersede: boolean;
  @ApiProperty({ type: [ApprovalActionView] }) actions: ApprovalActionView[];
  @ApiProperty({
    description:
      'Whether the caller may decide this record (role, scope and the requester rule); the decision command still decides',
  })
  canDecide: boolean;
  @ApiProperty({ nullable: true, type: String })
  decisionBlockedReason: string | null;
  @ApiProperty({
    type: ApprovalChangeFieldView,
    nullable: true,
    description:
      'The one-line change of the row (first changed field); null where the change is read on the approval page only',
  })
  headline: ApprovalChangeFieldView | null;
  @ApiProperty({ type: ApprovalTargetView }) target: ApprovalTargetView;
}
export class ApprovalInboxView {
  @ApiProperty({ type: [ApprovalItemView] }) items: ApprovalItemView[];
  @ApiProperty({ nullable: true, type: String }) nextCursor: string | null;
  @ApiProperty() asOf: string;
  @ApiProperty({ type: Object }) scope: { tenantId: string };
}
