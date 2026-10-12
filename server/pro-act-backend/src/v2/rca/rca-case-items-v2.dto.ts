import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  OptionalBool,
  OptionalIn,
  OptionalIso,
  OptionalStrings,
  OptionalText,
  OptionalUuid,
} from './rca-dto-helpers';

export const RCA_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export const RCA_FIVE_P = [
  'Parts',
  'Paper',
  'People',
  'Place',
  'Process',
] as const;
export const RCA_TASK_STATES = ['pending', 'completed'] as const;
export const RCA_SERIES_MODES = [
  'recorded',
  'interpolated',
  'summary',
  'plot',
] as const;
export const RCA_SERIES_PROVIDERS = ['pi'] as const;
export const RCA_DIAGRAM_EVENT_TYPES = [
  'Failure',
  'Alarm',
  'Action',
  'Note',
  'Maintenance',
  'Inspection',
  'Operator Action',
  'Info',
] as const;

/** An item id chosen by the client (short label, kept as given). */
function ItemId(required: boolean): PropertyDecorator {
  return (target, key) => {
    if (!required) IsOptional()(target, key);
    IsString()(target, key);
    IsNotEmpty()(target, key);
    MaxLength(64)(target, key);
    (required ? ApiProperty : ApiPropertyOptional)({ maxLength: 64 })(
      target,
      key,
    );
  };
}

export class RcaRecommendationItemDto {
  @ItemId(false) id?: string;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @OptionalText(4000) description?: string | null;
  @OptionalText(20) priority?: string | null;
  @OptionalUuid() ownerId?: string | null;
  @OptionalIso() dueDate?: string | null;
  @OptionalText(30) status?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Estimated cost as a decimal string (no currency)',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Matches(/^\d{1,13}(\.\d{1,4})?$/)
  estimatedCost?: string | null;
}

/** Historian query recorded with a "Time Series" evidence item (the parameters, not the samples). */
export class RcaEvidenceSeriesDto {
  @OptionalIn(RCA_SERIES_PROVIDERS) provider?: string | null;
  @OptionalText(2000) streams?: string | null;
  @OptionalIn(RCA_SERIES_MODES) mode?: string | null;
  @OptionalIso() start?: string | null;
  @OptionalIso() end?: string | null;
  @OptionalText(20) interval?: string | null;

  @ApiPropertyOptional({ nullable: true, minimum: 1, maximum: 10000 })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(10000)
  intervals?: number | null;

  @OptionalText(100) summaryTypes?: string | null;
}

/** A file stored by `POST /v2/rcas/{id}/attachments` and referenced by an evidence item. */
export class RcaEvidenceAttachmentDto {
  @ApiProperty({
    description: 'Stored file name returned by the upload',
    maxLength: 100,
  })
  @IsString()
  @Matches(/^[0-9a-f-]{36}\.[a-z0-9]{1,5}$/)
  fileName: string;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @OptionalText(100) contentType?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  @Min(0)
  size?: number | null;
}

export class RcaEvidenceItemDto {
  @ItemId(false) id?: string;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @OptionalText(4000) description?: string | null;
  @OptionalText(50) type?: string | null;
  @OptionalText(500) source?: string | null;
  @OptionalIso() collectedAt?: string | null;
  @OptionalUuid() collectedBy?: string | null;
  @OptionalText(100) category?: string | null;
  @OptionalText(100) location?: string | null;
  @OptionalIso() occurredAt?: string | null;
  @OptionalUuid() assetId?: string | null;
  @OptionalIn(RCA_SEVERITIES) severity?: string | null;
  @OptionalStrings(20, 50) tags?: string[];
  @OptionalBool() verified?: boolean | null;
  @OptionalIn(RCA_FIVE_P) fiveP?: string | null;
  @OptionalText(2000) task?: string | null;
  @OptionalIso() taskDueDate?: string | null;
  @OptionalIn(RCA_TASK_STATES) taskStatus?: string | null;

  /** logic tree nodes / diagram events this item supports */
  @OptionalStrings(100, 64) nodeIds?: string[];

  @ApiPropertyOptional({ type: RcaEvidenceSeriesDto, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @ValidateNested()
  @Type(() => RcaEvidenceSeriesDto)
  timeSeries?: RcaEvidenceSeriesDto | null;

  @ApiPropertyOptional({ type: [RcaEvidenceAttachmentDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => RcaEvidenceAttachmentDto)
  attachments?: RcaEvidenceAttachmentDto[];
}

export class RcaLogicNodeDto {
  @ItemId(true) id: string;
  @OptionalText(64) parentId?: string | null;

  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MaxLength(500)
  label: string;

  @OptionalText(50) kind?: string | null;
  @OptionalText(50) status?: string | null;
  @OptionalText(4000) notes?: string | null;
  @OptionalText(50) code?: string | null;
  @OptionalText(4000) description?: string | null;
  @OptionalBool() verified?: boolean | null;
}

export class RcaDiagramPositionDto {
  @ApiProperty() @IsNumber() x: number;
  @ApiProperty() @IsNumber() y: number;
}

/** One event of the case's event diagram (also listed on the event timeline). */
export class RcaDiagramNodeDto {
  @ItemId(true) id: string;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  label: string;

  @OptionalIn(RCA_DIAGRAM_EVENT_TYPES) type?: string | null;
  @OptionalIso() timestamp?: string | null;
  @OptionalText(2000) description?: string | null;
  @OptionalText(255) asset?: string | null;
  @OptionalIn(RCA_SEVERITIES) severity?: string | null;

  @ApiProperty({ type: RcaDiagramPositionDto })
  @ValidateNested()
  @Type(() => RcaDiagramPositionDto)
  position: RcaDiagramPositionDto;
}

export class RcaDiagramEdgeDto {
  @ItemId(true) id: string;
  @ItemId(true) source: string;
  @ItemId(true) target: string;
}

export class RcaEventDiagramDto {
  @ApiProperty({ type: [RcaDiagramNodeDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => RcaDiagramNodeDto)
  nodes: RcaDiagramNodeDto[];

  @ApiProperty({ type: [RcaDiagramEdgeDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => RcaDiagramEdgeDto)
  edges: RcaDiagramEdgeDto[];
}
