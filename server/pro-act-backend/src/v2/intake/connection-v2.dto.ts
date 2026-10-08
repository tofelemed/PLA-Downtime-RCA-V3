import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { toBooleanParam } from '../../common/dto/query-param.transformers';
import {
  SOURCE_TYPES,
  SourceType,
} from '../../intake/envelope/canonical-envelope';
import { ListQueryDto } from '../common/list-query.dto';

/** Body of POST /connections. */
export class CreateConnectionV2Dto {
  @ApiProperty({ enum: SOURCE_TYPES })
  @IsIn(SOURCE_TYPES)
  sourceType: SourceType;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  displayName: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Adapter endpoint settings (URL, broker, topics ...). Keys that look like credentials (password, ' +
      'secret, token, apiKey) are rejected with 422 SECRET_IN_CONFIG: send credentials as `secret`.',
  })
  @IsObject()
  endpointConfig: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Credential stored AES-256-GCM encrypted in `secrets`; never returned (views show `hasSecret`)',
    maxLength: 4096,
  })
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  secret?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** GET /connections: keyset pages on (createdAt, id). */
export class ConnectionListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: SOURCE_TYPES })
  @IsOptional()
  @IsIn(SOURCE_TYPES)
  sourceType?: SourceType;

  @ApiPropertyOptional({ description: 'Include inactive connections' })
  @IsOptional()
  @Transform(toBooleanParam)
  @IsBoolean()
  includeInactive?: boolean;
}
