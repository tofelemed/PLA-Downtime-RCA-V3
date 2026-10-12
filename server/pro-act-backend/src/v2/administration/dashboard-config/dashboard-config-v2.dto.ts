import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const PERCENT = { minimum: 0, maximum: 100 };

export class OeeSettingsDto {
  @ApiProperty({ minimum: 0, maximum: 10 })
  @IsNumber()
  @Min(0)
  @Max(10)
  availabilityWeight: number;
  @ApiProperty({ minimum: 0, maximum: 10 })
  @IsNumber()
  @Min(0)
  @Max(10)
  performanceWeight: number;
  @ApiProperty({ minimum: 0, maximum: 10 })
  @IsNumber()
  @Min(0)
  @Max(10)
  qualityWeight: number;
  @ApiProperty(PERCENT) @IsNumber() @Min(0) @Max(100) targetOEE: number;
  @ApiProperty(PERCENT)
  @IsNumber()
  @Min(0)
  @Max(100)
  targetAvailability: number;
  @ApiProperty(PERCENT) @IsNumber() @Min(0) @Max(100) targetPerformance: number;
  @ApiProperty(PERCENT) @IsNumber() @Min(0) @Max(100) targetQuality: number;
}

export class LossSettingsDto {
  @ApiProperty({ minimum: 0 }) @IsNumber() @Min(0) lossValuePerUnit: number;
  @ApiProperty(PERCENT) @IsNumber() @Min(0) @Max(100) highLossThreshold: number;
  @ApiProperty(PERCENT)
  @IsNumber()
  @Min(0)
  @Max(100)
  criticalLossThreshold: number;
  @ApiProperty(PERCENT)
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultUnaccountedLossPercentage: number;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  defaultLossCategories: string[];
}

export const COST_METHODS = ['perUnit', 'perHour', 'fixed'] as const;
export class CostSettingsDto {
  @ApiProperty({ enum: COST_METHODS })
  @IsIn(COST_METHODS)
  costCalculationMethod: string;
  @ApiProperty({ minimum: 0 }) @IsNumber() @Min(0) defaultCostPerUnit: number;
  @ApiProperty({ minimum: 0 }) @IsNumber() @Min(0) defaultCostPerHour: number;
  @ApiProperty({ minimum: 0 }) @IsNumber() @Min(0) highCostThreshold: number;
  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  criticalCostThreshold: number;
}

const SHARE = { minimum: 0, maximum: 1 };
export class BottleneckSettingsDto {
  @ApiProperty(SHARE) @IsNumber() @Min(0) @Max(1) lossWeight: number;
  @ApiProperty(SHARE) @IsNumber() @Min(0) @Max(1) costWeight: number;
  @ApiProperty(SHARE) @IsNumber() @Min(0) @Max(1) oeeWeight: number;
  @ApiProperty(SHARE) @IsNumber() @Min(0) @Max(1) lowRiskThreshold: number;
  @ApiProperty(SHARE) @IsNumber() @Min(0) @Max(1) mediumRiskThreshold: number;
  @ApiProperty(SHARE) @IsNumber() @Min(0) @Max(1) highRiskThreshold: number;
}

export const NUMBER_FORMATS = ['en-US', 'en-GB', 'de-DE', 'custom'] as const;
export const DISPLAY_THEMES = [
  'default',
  'high-contrast',
  'colorblind-friendly',
] as const;
export class DisplaySettingsDto {
  @ApiProperty() @IsBoolean() showOEE: boolean;
  @ApiProperty() @IsBoolean() showLosses: boolean;
  @ApiProperty() @IsBoolean() showCosts: boolean;
  @ApiProperty() @IsBoolean() showCapacity: boolean;
  @ApiProperty() @IsBoolean() showActions: boolean;
  @ApiProperty({ minimum: 0, maximum: 6 })
  @IsInt()
  @Min(0)
  @Max(6)
  decimalPlaces: number;
  @ApiProperty({ maxLength: 8 })
  @IsString()
  @MaxLength(8)
  currencySymbol: string;
  @ApiProperty({ enum: NUMBER_FORMATS })
  @IsIn(NUMBER_FORMATS)
  numberFormat: string;
  @ApiProperty({ enum: DISPLAY_THEMES }) @IsIn(DISPLAY_THEMES) theme: string;
}

export const PERFORMANCE_METHODS = [
  'cycleTime',
  'outputRate',
  'efficiency',
] as const;
export class PerformanceSettingsDto {
  @ApiProperty({ minimum: 0, description: 'seconds' })
  @IsNumber()
  @Min(0)
  defaultIdealCycleTime: number;
  @ApiProperty({ enum: PERFORMANCE_METHODS })
  @IsIn(PERFORMANCE_METHODS)
  performanceCalculationMethod: string;
  @ApiProperty(PERCENT)
  @IsNumber()
  @Min(0)
  @Max(100)
  lowPerformanceThreshold: number;
  @ApiProperty(PERCENT)
  @IsNumber()
  @Min(0)
  @Max(100)
  highPerformanceThreshold: number;
}

export const QUALITY_METHODS = ['defects', 'rework', 'scrap'] as const;
export class QualitySettingsDto {
  @ApiProperty({ enum: QUALITY_METHODS })
  @IsIn(QUALITY_METHODS)
  qualityCalculationMethod: string;
  @ApiProperty(PERCENT)
  @IsNumber()
  @Min(0)
  @Max(100)
  lowQualityThreshold: number;
  @ApiProperty(PERCENT)
  @IsNumber()
  @Min(0)
  @Max(100)
  highQualityThreshold: number;
}

export const AVAILABILITY_METHODS = [
  'uptime',
  'downtime',
  'scheduled',
] as const;
export class AvailabilitySettingsDto {
  @ApiProperty({ enum: AVAILABILITY_METHODS })
  @IsIn(AVAILABILITY_METHODS)
  availabilityCalculationMethod: string;
  @ApiProperty(PERCENT)
  @IsNumber()
  @Min(0)
  @Max(100)
  lowAvailabilityThreshold: number;
  @ApiProperty(PERCENT)
  @IsNumber()
  @Min(0)
  @Max(100)
  highAvailabilityThreshold: number;
}

/** `PUT /v2/dashboard-configuration`: every section of the plant's dashboard settings. */
export class DashboardSettingsDto {
  @ApiProperty({ type: OeeSettingsDto })
  @ValidateNested()
  @Type(() => OeeSettingsDto)
  oee: OeeSettingsDto;
  @ApiProperty({ type: LossSettingsDto })
  @ValidateNested()
  @Type(() => LossSettingsDto)
  losses: LossSettingsDto;
  @ApiProperty({ type: CostSettingsDto })
  @ValidateNested()
  @Type(() => CostSettingsDto)
  costs: CostSettingsDto;
  @ApiProperty({ type: BottleneckSettingsDto })
  @ValidateNested()
  @Type(() => BottleneckSettingsDto)
  bottleneckRisk: BottleneckSettingsDto;
  @ApiProperty({ type: DisplaySettingsDto })
  @ValidateNested()
  @Type(() => DisplaySettingsDto)
  display: DisplaySettingsDto;
  @ApiProperty({ type: PerformanceSettingsDto })
  @ValidateNested()
  @Type(() => PerformanceSettingsDto)
  performance: PerformanceSettingsDto;
  @ApiProperty({ type: QualitySettingsDto })
  @ValidateNested()
  @Type(() => QualitySettingsDto)
  quality: QualitySettingsDto;
  @ApiProperty({ type: AvailabilitySettingsDto })
  @ValidateNested()
  @Type(() => AvailabilitySettingsDto)
  availability: AvailabilitySettingsDto;
}

/** `GET /v2/dashboard-configuration`: the stored settings, or the defaults when none are stored. */
export class DashboardConfigV2View {
  @ApiProperty({ type: DashboardSettingsDto }) settings: DashboardSettingsDto;
  @ApiProperty({ description: 'false while the plant uses the defaults' })
  isStored: boolean;
  @ApiProperty({ nullable: true, type: String }) updatedAt: string | null;
  @ApiProperty({ nullable: true, type: String }) updatedByName: string | null;
}
