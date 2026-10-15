import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

/** `:month` of the month close routes: `YYYY-MM` in the plant's financial calendar. */
export class MonthParamDto {
  @ApiProperty({
    description:
      'Financial month `YYYY-MM` in the month_close policy calendar (Solar Hijri plants: e.g. 1405-07)',
    example: '1405-07',
  })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month: string;
}

export class MonthCloseStepDto {
  @ApiPropertyOptional({ description: 'Sign-off comment, kept on the history' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class MonthCloseReopenDto {
  @ApiProperty({
    description: 'Why the month is reopened (every sign-off is cleared)',
  })
  @IsString()
  @Length(1, 2000)
  reason: string;
}
