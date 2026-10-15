import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import {
  DELEGABLE_ROLES,
  DELEGATION_SCOPE_KINDS,
  DelegableRole,
  DelegationScopeKind,
} from '../../../auth/delegations/role-delegation.entity';
import { ListQueryDto } from '../../common/list-query.dto';

export class RoleDelegationsListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({
    enum: ['in_force', 'all'],
    default: 'all',
    description: '`in_force`: started, not ended, not revoked (now)',
  })
  @IsOptional()
  @IsIn(['in_force', 'all'])
  state?: 'in_force' | 'all';

  @ApiPropertyOptional({ enum: ['-createdAt'] })
  @IsOptional()
  @IsIn(['-createdAt'])
  sort?: string = undefined;
}

/** `POST /role-delegations` (SME R1 / R6): who hands which approval role on which scope to whom, when and why. */
export class CreateRoleDelegationDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Who hands the role over (holds it on the scope)',
  })
  @IsUUID()
  delegatorId: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Who holds it meanwhile (an active member of the plant)',
  })
  @IsUUID()
  delegateId: string;

  @ApiProperty({ enum: DELEGABLE_ROLES })
  @IsIn(DELEGABLE_ROLES)
  role: DelegableRole;

  @ApiProperty({ enum: DELEGATION_SCOPE_KINDS })
  @IsIn(DELEGATION_SCOPE_KINDS)
  scopeKind: DelegationScopeKind;

  @ApiProperty({
    format: 'uuid',
    description: 'The plant (tenant), site or unit id',
  })
  @IsUUID()
  scopeId: string;

  @ApiProperty({ format: 'date-time', description: 'Start (UTC, inclusive)' })
  @IsISO8601({ strict: true })
  validFrom: string;

  @ApiProperty({
    format: 'date-time',
    description: 'End (UTC, exclusive); at most 90 days after the start',
  })
  @IsISO8601({ strict: true })
  validUntil: string;

  @ApiProperty({
    minLength: 1,
    maxLength: 2000,
    description: 'Why (e.g. leave, plant shutdown cover)',
  })
  @IsString()
  @Matches(/\S/, { message: 'reason must not be blank' })
  @Length(1, 2000)
  reason: string;
}

export class RevokeRoleDelegationDto {
  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @IsString()
  @Matches(/\S/, { message: 'reason must not be blank' })
  @Length(1, 2000)
  reason: string;
}
