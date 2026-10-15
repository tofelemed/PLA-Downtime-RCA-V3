import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export const TRANSITION_ALLOWANCE_OPTIONS = ['planned', 'loss'] as const;
export type TransitionAllowanceOption =
  (typeof TRANSITION_ALLOWANCE_OPTIONS)[number];

const UNIT = 'Unit override; absent = the tenant-wide version';

export class TransitionAllowanceQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: UNIT })
  @IsOptional()
  @IsUUID()
  unitId?: string;
}

/** Engine 2.5.6: the transition-allowance part of a new `oee_policy` version; every other field is kept. */
export class TransitionAllowanceCreateDto {
  @ApiPropertyOptional({ format: 'uuid', description: UNIT })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiProperty({
    enum: TRANSITION_ALLOWANCE_OPTIONS,
    description:
      '`planned`: the plan target already allows for standard grade transitions — only the overrun counts ' +
      'against the plan, the allowance is shown as information. `loss`: the plan does not deduct ' +
      'transitions — the allowance is a plan-ledger loss line.',
  })
  @IsIn(TRANSITION_ALLOWANCE_OPTIONS)
  transitionAllowanceInPlan: TransitionAllowanceOption;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
