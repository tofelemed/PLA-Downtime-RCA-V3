import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PI_PROXY_ALLOWED_METHODS, PIProxyMethod } from '../pi-proxy-policy';
import { PIProxyTargetDto } from './pi-proxy-target.dto';

export class PIProxyRequestDto extends PIProxyTargetDto {
  @ApiProperty({
    example: '/assetservers',
    description: 'Path under the connection PI Web API root',
  })
  @IsString()
  @MaxLength(2000)
  path: string;

  @ApiPropertyOptional({ enum: PI_PROXY_ALLOWED_METHODS, default: 'GET' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsIn(PI_PROXY_ALLOWED_METHODS)
  method?: PIProxyMethod;

  @ApiPropertyOptional({
    description: 'Overrides the stored connection credentials for this call',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  username?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  password?: string;

  @ApiPropertyOptional({
    type: Object,
    description: 'JSON body for POST requests',
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object, description: 'Query parameters' })
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}
