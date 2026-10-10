import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { toArrayParam } from '../../common/dto/query-param.transformers';
import {
  RULE_KINDS,
  RULE_STATES,
  RuleKind,
  RuleState,
} from '../../rules/grammar/rule-catalog';
import { ListQueryDto } from '../common/list-query.dto';

const DEFINITION_DOC = {
  type: 'object',
  additionalProperties: true,
  description:
    'Rule definition (contracts/rules/rule-definition.schema.json): `{ when: { all?, any? }, then: [...] }`. ' +
    'Validated on the server; 422 RULE_INVALID with `fieldErrors` paths such as `definition.when.all.0.op`.',
} as const;

export class RuleV2ListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: RULE_KINDS })
  @IsOptional()
  @IsIn(RULE_KINDS)
  kind?: RuleKind;

  @ApiPropertyOptional({ enum: RULE_STATES })
  @IsOptional()
  @IsIn(RULE_STATES)
  state?: RuleState;
}

/** Fields of a rule other than its kind (the kind never changes). */
export class RuleV2FieldsDto {
  @ApiPropertyOptional({ nullable: true, maxLength: 2000 })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 10000,
    default: 100,
    description:
      'Evaluation order among active rules of one kind (lower first)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  priority?: number;
}

export class RuleV2CreateDto extends RuleV2FieldsDto {
  @ApiProperty({ enum: RULE_KINDS })
  @IsIn(RULE_KINDS)
  kind: RuleKind;

  @ApiProperty({ maxLength: 120, description: 'Unique per tenant' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty(DEFINITION_DOC)
  @IsObject()
  definition: Record<string, unknown>;
}

/** Body of PUT /rules/{id}: changes the draft (a new definition) and descriptive fields. */
export class RuleV2ChangeDto extends RuleV2FieldsDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional(DEFINITION_DOC)
  @IsOptional()
  @IsObject()
  definition?: Record<string, unknown>;
}

export class RuleV2ValidateDto {
  @ApiProperty({ enum: RULE_KINDS })
  @IsIn(RULE_KINDS)
  kind: RuleKind;

  @ApiProperty(DEFINITION_DOC)
  @IsObject()
  definition: Record<string, unknown>;
}

export class RuleV2ReasonDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RuleV2RollbackDto extends RuleV2ReasonDto {
  @ApiProperty({
    minimum: 1,
    description: 'Version whose definition becomes the next version',
  })
  @IsInt()
  @Min(1)
  toVersion: number;
}

export class RuleV2SimulateDto {
  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true })
  from: string;

  @ApiProperty({
    format: 'date-time',
    description: 'Exclusive; at most 92 days after `from`',
  })
  @IsISO8601({ strict: true })
  to: string;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  unitIds?: string[];

  @ApiPropertyOptional({
    minimum: 1,
    description:
      'Version to simulate; omitted = the draft, else the version in force',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}
