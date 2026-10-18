import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEmail,
  IsBoolean,
  IsIn,
} from 'class-validator';
import {
  CALENDAR_SYSTEMS,
  CalendarSystem,
  DIGIT_SYSTEMS,
  DigitSystem,
} from '../tenant-display-settings';

export class CreateTenantDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ required: false, default: true })
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

  @ApiProperty({
    required: false,
    enum: CALENDAR_SYSTEMS,
    default: 'gregorian',
  })
  @IsOptional()
  @IsIn(CALENDAR_SYSTEMS)
  calendarSystem?: CalendarSystem;

  @ApiProperty({ required: false, enum: DIGIT_SYSTEMS, default: 'latin' })
  @IsOptional()
  @IsIn(DIGIT_SYSTEMS)
  digits?: DigitSystem;
}
