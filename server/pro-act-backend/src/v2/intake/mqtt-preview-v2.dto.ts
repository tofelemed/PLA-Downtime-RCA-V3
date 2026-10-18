import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** A bounded, user-supplied packet; neither subscribed nor persisted. */
export class MqttPreviewV2Dto {
  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  topic: string;

  @ApiProperty({
    maxLength: 65536,
    description: 'Raw JSON payload text; decoded by the saved profile',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(65536)
  payload: string;

  @ApiProperty({
    description: 'Receive instant for timestamp validation, ISO 8601',
  })
  @IsISO8601()
  receivedAt: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  retained?: boolean;
}
