import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  CODE_MAPPING_RULE_KINDS,
  CodeMappingRuleKind,
} from '../../code-library/code-library-kind';
import { ListQueryDto } from '../common/list-query.dto';

export class CodeMappingRuleV2CreateDto {
  @ApiProperty({ enum: CODE_MAPPING_RULE_KINDS })
  @IsIn(CODE_MAPPING_RULE_KINDS)
  ruleKind: CodeMappingRuleKind;

  @ApiProperty({
    format: 'uuid',
    description:
      'Reason code (reason_* kinds) or impact code (impact_to_valuation)',
  })
  @IsUUID()
  sourceCodeId: string;

  @ApiPropertyOptional({
    description:
      'OEE component (reason_to_oee), schedule class (reason_to_schedule_class) or decimal cost per hour (impact_to_valuation)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  targetValue?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Impact code (reason_to_impact)',
  })
  @IsOptional()
  @IsUUID()
  targetCodeId?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description:
      'Start of validity (default now); not before the previous version',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  effectiveFrom?: string;
}

export class CodeMappingRuleV2ListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: ['createdAt'], default: 'createdAt' })
  @IsOptional()
  @IsIn(['createdAt'])
  sort?: string = undefined;

  @ApiPropertyOptional({ enum: CODE_MAPPING_RULE_KINDS })
  @IsOptional()
  @IsIn(CODE_MAPPING_RULE_KINDS)
  ruleKind?: CodeMappingRuleKind;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sourceCodeId?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Only the version in force at this instant',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  asOf?: string;
}
