import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  PI_PROXY_ALLOWED_METHODS,
  PIProxyMethod,
} from '../../pi-proxy/pi-proxy-policy';

/**
 * Browser request to the tenant's PI Web API with the stored credentials (§4.2, I12): a path under the
 * allowlisted controllers, GET (or POST to `/batch`), query parameters and a JSON body only.
 */
export class PIBrowserRequestDto {
  @ApiProperty({
    example: '/assetservers',
    description:
      'Path under the connection PI Web API root (allowlisted controllers only)',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  path: string;

  @ApiPropertyOptional({ enum: PI_PROXY_ALLOWED_METHODS, default: 'GET' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsIn(PI_PROXY_ALLOWED_METHODS)
  method?: PIProxyMethod;

  @ApiPropertyOptional({ type: Object, description: 'Query parameters' })
  @IsOptional()
  @IsObject()
  params?: Record<string, string | number | boolean>;

  @ApiPropertyOptional({
    type: Object,
    description: 'JSON body (POST /batch only)',
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
