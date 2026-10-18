import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

/**
 * `:month` of the month close routes: `YYYY-MM` in the plant's financial calendar, or calendar-qualified
 * (`persian:1405-07`, `gregorian:2026-10`). A month of the other calendar is refused (422).
 */
export class MonthParamDto {
  @ApiProperty({
    description:
      'Financial month `YYYY-MM` in the month_close policy calendar (Solar Hijri plants: e.g. 1405-07), or ' +
      'calendar-qualified `persian:YYYY-MM` / `gregorian:YYYY-MM`. A month of the other calendar — explicit, ' +
      'or a bare key whose year belongs to it (e.g. 2026-10 on a Solar Hijri plant) — is refused with 422 ' +
      'MONTH_CALENDAR_MISMATCH / MONTH_KEY_AMBIGUOUS; `details.overlaps` names the plant months it overlaps.',
    example: '1405-07',
  })
  @Matches(/^(?:(?:gregorian|persian):)?\d{4}-(0[1-9]|1[0-2])$/)
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
