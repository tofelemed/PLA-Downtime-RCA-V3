import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/** Logout body (plan 3.11): the refresh token whose sign-in family is revoked. */
export class LogoutDto {
  @ApiPropertyOptional({
    description:
      'Refresh token of the session to end; its whole family is revoked',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
