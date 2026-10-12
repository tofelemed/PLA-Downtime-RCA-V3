import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
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

/** `POST /v2/user-scopes`: a role in the whole acting plant, or in one of its units. */
export class GrantUserScopeDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

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
