import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ListQueryDto } from '../common/list-query.dto';
import { LOCAL_DATE } from './calendar-version-v2.dto';

export class CrewCreateDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Default: the tenant default site',
  })
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @ApiProperty({ example: 'Crew A' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}

export class CrewListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  siteId?: string;
}

export class RotationPatternDto {
  @ApiProperty({
    example: '2026-10-05',
    description: 'Operational date of cycle[0]',
  })
  @Matches(LOCAL_DATE, {
    message: 'anchorDate must be a local date YYYY-MM-DD',
  })
  anchorDate: string;

  @ApiProperty({
    type: [String],
    nullable: true,
    example: ['A', 'A', 'B', 'B', 'C', 'C', null, null],
    description: 'Shift name per day of the cycle; null = off',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(366)
  @ValidateIf((_o, v) => v !== null, { each: true })
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  cycle: Array<string | null>;
}

/** Body of POST /crew-rotations. */
export class CrewRotationCreateDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  crewId: string;

  @ApiProperty({ type: RotationPatternDto })
  @ValidateNested()
  @Type(() => RotationPatternDto)
  pattern: RotationPatternDto;

  @ApiProperty({ example: '2026-10-10' })
  @Matches(LOCAL_DATE, {
    message: 'effectiveFrom must be a local date YYYY-MM-DD',
  })
  effectiveFrom: string;

  @ApiPropertyOptional({ nullable: true, description: 'Exclusive end date' })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Matches(LOCAL_DATE, {
    message: 'effectiveTo must be a local date YYYY-MM-DD',
  })
  effectiveTo?: string | null;
}

export class CrewRotationListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  crewId?: string;
}
