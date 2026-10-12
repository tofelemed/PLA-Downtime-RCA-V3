import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { SCOPE_ROLES, type ScopeRole } from '../../../auth/roles/role-model';
import { ListQueryDto } from '../../common/list-query.dto';

export const SCOPE_SORTS = ['-createdAt', 'createdAt'] as const;

/** `GET /v2/user-scopes`: scope grants in the acting plant. */
export class UserScopesListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ description: 'Grants of this user only' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ enum: SCOPE_SORTS, default: '-createdAt' })
  @IsOptional()
  @IsIn(SCOPE_SORTS)
  sort?: string = undefined;
}

/**
 * `POST /v2/user-scopes`: a role in the whole acting plant, or in one of its units, for a user of the plant
 * (`userId`) or — a first grant into the plant — the user with exactly this e-mail in the plant's
 * organization (`email`). Exactly one of the two.
 */
export class GrantUserScopeDto {
  @ApiPropertyOptional({ description: 'The user (required unless `email`)' })
  @ValidateIf((dto: GrantUserScopeDto) => dto.email === undefined)
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    maxLength: 255,
    description:
      "Exact e-mail of a user of the plant's organization (instead of `userId`)",
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiProperty({ enum: SCOPE_ROLES })
  @IsIn(SCOPE_ROLES)
  role: ScopeRole;

  @ApiPropertyOptional({
    description:
      'Limit the grant to this unit of the plant (omit for the whole plant)',
  })
  @IsOptional()
  @IsUUID()
  unitId?: string;
}
