import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Commissioning backdate fields of a policy write (owner, 18 Oct 2026): absent = effective at approval /
 * record time, as before. A past instant needs a reason and no calculated period of the scope in range.
 */
export class CommissioningBackdateDto {
  @ApiPropertyOptional({
    format: 'date-time',
    description:
      'Commissioning only: a past instant the version takes effect from instead of approval / record time. ' +
      'Requires backdateReason; 422 INVALID_EFFECTIVE_FROM (not past), 409 BACKDATE_REWRITES_HISTORY (not after the ' +
      'latest approved version of the scope), 409 BACKDATE_OVERLAPS_CALCULATION (a calculated period of the unit, or ' +
      'of any unit for a plant-wide version, overlaps [effectiveFrom, now); details.periods lists them).',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  effectiveFrom?: string;

  @ApiPropertyOptional({
    maxLength: 1000,
    description:
      'Why the version is backdated; required with effectiveFrom (422 BACKDATE_REASON_REQUIRED), refused without it',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  backdateReason?: string;
}
