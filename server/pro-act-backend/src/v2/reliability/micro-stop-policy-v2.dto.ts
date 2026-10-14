import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const UNIT = 'Unit override; absent = the tenant-wide version';

export class MicroStopPolicyQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: UNIT })
  @IsOptional()
  @IsUUID()
  unitId?: string;
}

/** SME D6: the micro-stop part of a new `oee_policy` version; every other field is kept from the version in force. */
export class MicroStopPolicyCreateDto {
  @ApiPropertyOptional({ format: 'uuid', description: UNIT })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiProperty({
    minimum: 0,
    maximum: 86400,
    description:
      'Unit threshold (s): shorter stops stay in running time and reduce performance',
  })
  @IsInt()
  @Min(0)
  @Max(86400)
  microStopSeconds: number;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'integer', minimum: 0 },
    example: { Bagger: 120, Conveyor: 120 },
    description:
      'Threshold per asset class (asset type → seconds); replaces the stated map. 0 = every stop of the class is an event',
  })
  @IsOptional()
  @IsObject()
  microStopSecondsByAssetClass?: Record<string, number>;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Reason codes of process trips: always availability events, never micro-stops',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tripReasonCodes?: string[];

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
