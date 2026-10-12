import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { toBooleanParam } from '../../common/dto/query-param.transformers';
import { ListQueryDto } from '../common/list-query.dto';
import {
  RcaEventDiagramDto,
  RcaEvidenceItemDto,
  RcaLogicNodeDto,
  RcaRecommendationItemDto,
} from './rca-case-items-v2.dto';
import { OptionalText } from './rca-dto-helpers';

export {
  RcaEvidenceItemDto,
  RcaLogicNodeDto,
  RcaRecommendationItemDto,
} from './rca-case-items-v2.dto';

export const RCA_STATUSES = [
  'Draft',
  'In Progress',
  'Analysis',
  'Published',
  'Closed',
] as const;
export type RcaStatus = (typeof RCA_STATUSES)[number];
export const RCA_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;

/**
 * v2 RCA case body (plan 3.9 step 1, the redesigned contract that closes the v1 save bug): the frontend
 * model's fields, scope ids and the nested recommendations / evidence / logic tree, all persisted.
 * Tenant and organization come from identity, never from the body.
 */
export class RcaCaseV2CreateDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @OptionalText(8000) description?: string | null;

  @ApiPropertyOptional({
    enum: RCA_STATUSES,
    description: 'Draft when omitted',
  })
  @IsOptional()
  @IsIn(RCA_STATUSES)
  status?: RcaStatus;

  @ApiPropertyOptional({
    enum: RCA_PRIORITIES,
    description: 'Medium when omitted',
  })
  @IsOptional()
  @IsIn(RCA_PRIORITIES)
  priority?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Unit scope; null = tenant-wide case (tenant-wide grant only)',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  unitId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  assetId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  teamLeadId?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  teamMemberIds?: string[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  targetCloseDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  actualCloseDate?: string | null;

  @OptionalText(8000) rootCause?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  templateId?: string | null;

  @ApiPropertyOptional({ type: [RcaRecommendationItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => RcaRecommendationItemDto)
  recommendations?: RcaRecommendationItemDto[];

  @ApiPropertyOptional({ type: [RcaEvidenceItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => RcaEvidenceItemDto)
  evidence?: RcaEvidenceItemDto[];

  @ApiPropertyOptional({ type: [RcaLogicNodeDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => RcaLogicNodeDto)
  logicTree?: RcaLogicNodeDto[];

  /** mission, scope and goals of the investigation team */
  @OptionalText(8000) teamCharter?: string | null;

  @ApiPropertyOptional({ type: RcaEventDiagramDto, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @ValidateNested()
  @Type(() => RcaEventDiagramDto)
  eventDiagram?: RcaEventDiagramDto | null;
}

export class RcaCaseV2UpdateDto extends PartialType(RcaCaseV2CreateDto) {}

export class RcaCaseV2ListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: RCA_STATUSES })
  @IsOptional()
  @IsIn(RCA_STATUSES)
  status?: RcaStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({
    description: 'Cases with a linked event of this asset (or the case asset)',
  })
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @ApiPropertyOptional({
    description: 'Cases with a linked event coded with this reason',
  })
  @IsOptional()
  @IsUUID()
  reasonCodeId?: string;

  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Case-insensitive title search',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: RCA_PRIORITIES })
  @IsOptional()
  @IsIn(RCA_PRIORITIES)
  priority?: string;

  @ApiPropertyOptional({
    description:
      'true = target close date passed and not Closed; false = the others',
  })
  @IsOptional()
  @Transform(toBooleanParam)
  @IsBoolean()
  overdue?: boolean;

  @ApiPropertyOptional({ enum: ['-createdAt', 'createdAt'] })
  @IsOptional()
  @IsIn(['-createdAt', 'createdAt'])
  sort?: string = undefined;
}
