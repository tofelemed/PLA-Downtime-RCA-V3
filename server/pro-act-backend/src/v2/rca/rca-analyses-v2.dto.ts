import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { OptionalStrings, OptionalText } from './rca-dto-helpers';

/**
 * Bodies of the nine RCA analysis tools that keep their own record (plan 3.9 follow-up, v1 parity): one
 * record per tool and case, replaced as sent (`PUT /v2/rcas/{id}/analyses/{tool}`).
 */
function Text(max: number, required = true): PropertyDecorator {
  return (target, key) => {
    IsString()(target, key);
    if (required) IsNotEmpty()(target, key);
    MaxLength(max)(target, key);
    ApiProperty({ maxLength: max })(target, key);
  };
}

function List<T>(type: () => new () => T, max: number): PropertyDecorator {
  return (target, key) => {
    IsArray()(target, key);
    ArrayMaxSize(max)(target, key);
    ValidateNested({ each: true })(target, key);
    Type(type)(target, key);
    ApiProperty({ type: [type()] })(target, key);
  };
}

/** CA5: a 1–10 rating that may stay null while not rated (a draft); never a default score. */
function OptionalScore(target: object, key: string | symbol): void {
  IsOptional()(target, key);
  ValidateIf((_: unknown, value: unknown) => value !== null)(target, key);
  IsInt()(target, key);
  Min(1)(target, key);
  Max(10)(target, key);
  ApiProperty({ minimum: 1, maximum: 10, nullable: true, required: false })(
    target,
    key,
  );
}

function OneOf(values: readonly string[]): PropertyDecorator {
  return (target, key) => {
    IsIn(values)(target, key);
    ApiProperty({ enum: values as string[] })(target, key);
  };
}

export const LIKELIHOODS = ['High', 'Medium', 'Low'] as const;
export const FAULT_TREE_NODE_TYPES = [
  'AND',
  'OR',
  'Event',
  'BasicEvent',
  'UndevelopedEvent',
] as const;
export const BARRIER_TYPES = [
  'Prevention',
  'Detection',
  'Mitigation',
  'Recovery',
] as const;
export const BARRIER_EFFECTIVENESS = [
  'Strong',
  'Moderate',
  'Weak',
  'Failed',
] as const;
export const CHANGE_CATEGORIES = [
  'People',
  'Equipment',
  'Process',
  'Materials',
  'Environment',
  'Management',
] as const;

export class FiveWhyLevelDto {
  @ApiProperty({ minimum: 1, maximum: 20 })
  @IsInt()
  @Min(1)
  @Max(20)
  level: number;
  @Text(1000) question: string;
  @Text(2000, false) answer: string;
  @OptionalText(2000) justification?: string | null;
}

export class FiveWhyV2Dto {
  @Text(4000) problem: string;
  @List(() => FiveWhyLevelDto, 20) whyLevels: FiveWhyLevelDto[];
  @Text(4000, false) rootCause: string;
}

export class FishboneCauseDto {
  @Text(64) id: string;
  @Text(1000) description: string;
  @ApiProperty() @IsBoolean() isPrimary: boolean;
  @OneOf(LIKELIHOODS) likelihood: string;
}

export class FishboneCategoryDto {
  @Text(64) id: string;
  @Text(100) name: string;
  @List(() => FishboneCauseDto, 50) causes: FishboneCauseDto[];
}

export class FishboneV2Dto {
  @Text(1000) effect: string;
  @List(() => FishboneCategoryDto, 12) categories: FishboneCategoryDto[];
}

export class FmeaEffectDto {
  @Text(64) id: string;
  @Text(2000, false) description: string;
  /** null = not rated yet (the analysis stays incomplete) */
  @OptionalScore severity?: number | null;
  @Text(1000, false) currentControls: string;
  /** deprecated (CA5): detection belongs to each cause; kept for older screens, not used in scoring */
  @OptionalScore detection?: number | null;
}

export class FmeaCauseDto {
  @Text(64) id: string;
  @Text(2000, false) description: string;
  @OptionalScore occurrence?: number | null;
  /** CA5: how well the cause's own control detects this cause / failure chain (10 = not detectable) */
  @OptionalScore detection?: number | null;
  /** the detection control the rating refers to */
  @OptionalText(1000) detectionControl?: string | null;
  @OptionalStrings(20, 500) recommendedActions?: string[];
}

export class FmeaV2Dto {
  @Text(255) failureMode: string;
  @List(() => FmeaEffectDto, 50) effects: FmeaEffectDto[];
  @List(() => FmeaCauseDto, 50) causes: FmeaCauseDto[];
}

export class FaultTreeNodeDto {
  @Text(64) id: string;
  @OneOf(FAULT_TREE_NODE_TYPES) type: string;
  @Text(1000, false) description: string;
  @OptionalText(64) parentId?: string | null;

  @ApiProperty({ required: false, nullable: true, minimum: 0, maximum: 1 })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  @Min(0)
  @Max(1)
  probability?: number | null;
}

export class FaultTreeV2Dto {
  @Text(255) topEvent: string;
  @List(() => FaultTreeNodeDto, 200) nodes: FaultTreeNodeDto[];
}

export class BarrierDto {
  @Text(64) id: string;
  @OneOf(BARRIER_TYPES) type: string;
  @Text(1000, false) description: string;
  @OneOf(BARRIER_EFFECTIVENESS) effectiveness: string;
  @OptionalText(1000) failureReason?: string | null;
  @OptionalStrings(20, 500) recommendations?: string[];
}

export class BarrierV2Dto {
  @Text(255) hazard: string;
  @List(() => BarrierDto, 50) barriers: BarrierDto[];
}

export class ChangeRecordDto {
  @Text(64) id: string;
  @OneOf(CHANGE_CATEGORIES) category: string;
  @Text(1000, false) description: string;
  @ApiProperty({ description: 'Calendar date of the change (YYYY-MM-DD)' })
  @IsISO8601()
  changeDate: string;
  @ApiProperty() @IsBoolean() relatedToIncident: boolean;
  @OneOf(LIKELIHOODS) impactLevel: string;
}

export class ChangeV2Dto {
  @Text(255) question: string;
  @List(() => ChangeRecordDto, 50) changes: ChangeRecordDto[];
}
