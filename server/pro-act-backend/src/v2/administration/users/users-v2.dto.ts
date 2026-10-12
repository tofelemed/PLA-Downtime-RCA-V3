import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { LEGACY_ROLES, type LegacyRole } from '../../../auth/roles/role-model';
import {
  toArrayParam,
  toBooleanParam,
} from '../../../common/dto/query-param.transformers';
import { ListQueryDto } from '../../common/list-query.dto';

export const USER_SORTS = ['name', '-name', '-createdAt', 'createdAt'] as const;
export const USER_REACHES = ['plant', 'everyone'] as const;
export type UserReach = (typeof USER_REACHES)[number];

/** `GET /v2/users`: the members of the acting plant (home plant or a scope grant there). */
export class UsersListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Case-insensitive search in name and e-mail',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: LEGACY_ROLES, isArray: true })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(LEGACY_ROLES.length)
  @IsIn(LEGACY_ROLES, { each: true })
  roles?: LegacyRole[];

  @ApiPropertyOptional({
    description: 'true = active only, false = deactivated only',
  })
  @IsOptional()
  @Transform(toBooleanParam)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    enum: USER_REACHES,
    default: 'plant',
    description:
      'plant (default): members of the acting plant, plus organization-level users for organization ' +
      'and super administrators; everyone: every user (super administrators only)',
  })
  @IsOptional()
  @IsIn(USER_REACHES)
  reach?: UserReach;

  @ApiPropertyOptional({ enum: USER_SORTS, default: 'name' })
  @IsOptional()
  @IsIn(USER_SORTS)
  sort?: string = undefined;
}

/** `GET /v2/users/directory`: names for ids (`ids`), or the active members of the plant (picker). */
export class UserDirectoryQueryDto {
  @ApiPropertyOptional({
    type: [String],
    description:
      'Resolve these users (inactive ones too); repeated parameter, at most 100',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  ids?: string[];

  @ApiPropertyOptional({ maxLength: 100, description: 'Search in names' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ description: 'Opaque cursor of the previous page' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 500, default: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit: number = 200;
}

export class CreateUserV2Dto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ maxLength: 255 })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty({ enum: LEGACY_ROLES })
  @IsIn(LEGACY_ROLES)
  role: LegacyRole;

  @ApiPropertyOptional({
    description:
      'Home plant; defaults to the acting plant (organization and super administrators may be created without one)',
  })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional({
    description: 'Organization; defaults to the plant’s organization',
  })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateUserV2Dto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({
    enum: LEGACY_ROLES,
    description: 'A role change is a grant: at most your own rank',
  })
  @IsOptional()
  @IsIn(LEGACY_ROLES)
  role?: LegacyRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ minLength: 8, maxLength: 128 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;
}
