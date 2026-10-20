import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDecimal, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

/**
 * D-T5: one reason of a weighted stop as the coder enters it — a percent of the stop or its duration in
 * seconds (one of the two, the same for every reason). The server normalises the list to fractions.
 */
export class ReasonWeightInputDto {
  @ApiProperty({ format: 'uuid', description: 'Reason (cause) code' })
  @IsUUID()
  reasonCodeId!: string;

  @ApiPropertyOptional({
    example: '60',
    description:
      'Share of the stop in percent (0 < p ≤ 100; the percents add up to 100)',
  })
  @IsOptional()
  @IsDecimal({ decimal_digits: '0,6' })
  percent?: string;

  @ApiPropertyOptional({
    example: 1800,
    description:
      'Share of the stop in seconds (the seconds add up to the closed stop’s duration within 1 s)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  seconds?: number;
}
