import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class FeatureFlagSetDto {
  @ApiProperty({ description: 'New value of the flag for the whole tenant' })
  @IsBoolean()
  enabled!: boolean;
}
