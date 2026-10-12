import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  CALENDAR_SYSTEMS,
  CalendarSystem,
  DIGIT_SYSTEMS,
  DigitSystem,
} from '../tenant-display-settings';

/** Body of `PUT /tenants/:id/display-settings`; omitted fields keep their current value. */
export class UpdateTenantDisplaySettingsDto {
  @ApiProperty({ required: false, enum: CALENDAR_SYSTEMS })
  @IsOptional()
  @IsIn(CALENDAR_SYSTEMS)
  calendarSystem?: CalendarSystem;

  @ApiProperty({ required: false, enum: DIGIT_SYSTEMS })
  @IsOptional()
  @IsIn(DIGIT_SYSTEMS)
  digits?: DigitSystem;
}
