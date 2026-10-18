import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEmail,
  IsUUID,
  IsIn,
} from 'class-validator';
import {
  CALENDAR_SYSTEMS,
  CalendarSystem,
  DIGIT_SYSTEMS,
  DigitSystem,
} from '../tenant-display-settings';

export class UpdateTenantDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  contactPerson?: string;

  @ApiProperty({ required: false })
  @IsEmail()
  @IsOptional()
  contactEmail?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  contactPhone?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiProperty({ required: false, enum: CALENDAR_SYSTEMS })
  @IsOptional()
  @IsIn(CALENDAR_SYSTEMS)
  calendarSystem?: CalendarSystem;

  @ApiProperty({ required: false, enum: DIGIT_SYSTEMS })
  @IsOptional()
  @IsIn(DIGIT_SYSTEMS)
  digits?: DigitSystem;
}
