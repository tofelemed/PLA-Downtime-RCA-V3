import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Response shapes of login / refresh / profile (documentation only; responses are not validated). */
export class SessionScopeDto {
  @ApiProperty({ format: 'uuid' })
  tenantId: string;

  @ApiPropertyOptional({ format: 'uuid' })
  organizationId?: string;

  @ApiProperty({
    description:
      'scope role held in the tenant (manager_approver, viewer, ...)',
  })
  role: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'set when the grant is limited to these units',
  })
  unitIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'set when the grant is limited to these sites',
  })
  siteIds?: string[];
}

export class SessionUserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ description: 'legacy role (users.role)' })
  role: string;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  tenantId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  organizationId?: string;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'tenant the legacy role applies in (users.tenant_id)',
  })
  homeTenantId: string | null;

  @ApiProperty({
    type: [SessionScopeDto],
    description: 'the user_scopes grants, grouped by tenant and role',
  })
  scopes: SessionScopeDto[];
}

export class LoginResponseDto {
  @ApiProperty()
  access_token: string;

  @ApiProperty()
  refresh_token: string;

  @ApiProperty({ description: 'access token lifetime in seconds' })
  expires_in: number;

  @ApiProperty({ example: 'Bearer' })
  token_type: string;

  @ApiProperty({ type: SessionUserDto })
  user: SessionUserDto;
}

export class ProfileResponseDto {
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ description: 'legacy role (users.role)' })
  role: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'tenant the request acted on (token tenant or X-Tenant-Id)',
  })
  tenantId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  organizationId?: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  homeTenantId: string | null;

  @ApiProperty({ type: [SessionScopeDto] })
  scopes: SessionScopeDto[];
}
