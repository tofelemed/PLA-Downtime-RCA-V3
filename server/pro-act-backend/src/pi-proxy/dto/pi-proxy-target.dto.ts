import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** Which of the caller's tenant PI connections to use; omit both when the tenant has exactly one. */
export class PIProxyTargetDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'PI connection id belonging to the caller tenant',
  })
  @IsOptional()
  @IsUUID()
  connectionId?: string;

  @ApiPropertyOptional({
    description:
      'PI Web API base URL; must match the host of a tenant connection',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  target?: string;
}
