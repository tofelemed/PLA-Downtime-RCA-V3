import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { SourceStatusMapping } from '../../periods/entities/source-status-mapping.entity';
import {
  inForceIdsOf,
  SourceStatusMappingsService,
} from '../../periods/source-status-mappings.service';
import { INSTANT, INSTANT_MESSAGE } from '../profiles/profile-v2.dto';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import { SOURCE_OWNERS, STATUS_MAPPING_AUTHORS } from './close-roles';

const SOURCE_SYSTEM = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

export class SourceStatusEntryDto {
  @ApiProperty({ example: 'AUTHORIZED' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  status: string;

  @ApiProperty({
    description:
      'The status is the source’s authorised final (released) record',
  })
  @IsBoolean()
  released: boolean;
}

export class SourceStatusMappingCreateDto {
  @ApiProperty({
    example: 'lims',
    description: '`import` = API / file imports of external reports',
  })
  @Matches(SOURCE_SYSTEM)
  sourceSystem: string;

  @ApiProperty({ description: 'UTC instant the version applies from' })
  @Matches(INSTANT, { message: `effectiveFrom ${INSTANT_MESSAGE}` })
  effectiveFrom: string;

  @ApiProperty({ type: [SourceStatusEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SourceStatusEntryDto)
  statuses: SourceStatusEntryDto[];

  @ApiPropertyOptional({
    description: 'The source workflow documentation it follows',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class SourceStatusMappingQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(SOURCE_SYSTEM)
  sourceSystem?: string;
}

export interface SourceStatusMappingV2View {
  id: string;
  sourceSystem: string;
  version: number;
  state: string;
  statuses: Array<{ status: string; released: boolean }>;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdBy: string | null;
  createdByName: string | null;
  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  /** the approved version imports of this source use now */
  inForce: boolean;
  notes: string | null;
}

interface ViewExtras {
  inForceIds?: ReadonlySet<string>;
  names?: ReadonlyMap<string, string>;
}

function toView(
  m: SourceStatusMapping,
  extras: ViewExtras = {},
): SourceStatusMappingV2View {
  const nameOf = (id: string | null) =>
    id ? (extras.names?.get(id) ?? null) : null;
  return {
    id: m.id,
    sourceSystem: m.sourceSystem,
    version: m.version,
    state: m.state,
    statuses: m.statuses,
    effectiveFrom: m.effectiveFrom.toISOString(),
    effectiveTo: m.effectiveTo ? m.effectiveTo.toISOString() : null,
    createdBy: m.createdBy,
    createdByName: nameOf(m.createdBy),
    approvedBy: m.approvedBy,
    approvedByName: nameOf(m.approvedBy),
    approvedAt: m.approvedAt ? m.approvedAt.toISOString() : null,
    inForce: (extras.inForceIds ?? inForceIdsOf([m], new Date())).has(m.id),
    notes: m.notes,
  };
}

/** Per-source status mappings of external production records (SME R13, phase R-D). */
@ApiTags('v2 · Production periods and actuals')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'source-status-mappings', version: '2' })
export class SourceStatusMappingsV2Controller {
  constructor(private readonly mappings: SourceStatusMappingsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Status mapping versions per source system, newest first, with the version in force now',
  })
  async list(
    @Ctx() ctx: RequestContext,
    @Query() query: SourceStatusMappingQueryDto,
  ): Promise<{ items: SourceStatusMappingV2View[] }> {
    const list = await this.mappings.list(ctx, query.sourceSystem);
    return { items: list.items.map((m) => toView(m, list)) };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @Roles(...STATUS_MAPPING_AUTHORS)
  @ApiOperation({
    summary:
      'Draft a new mapping version of a source system (which statuses are released)',
    description:
      'Requires `Idempotency-Key` and a tenant-wide grant. It applies once the source owner approves it.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: SourceStatusMappingCreateDto,
  ): Promise<SourceStatusMappingV2View> {
    const created = await this.mappings.create(ctx, {
      sourceSystem: body.sourceSystem,
      effectiveFrom: new Date(body.effectiveFrom),
      statuses: body.statuses,
      notes: body.notes ?? null,
    });
    return toView(created);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @Roles(...SOURCE_OWNERS)
  @ApiOperation({
    summary:
      'The source owner approves a draft mapping version (except SuperAdmin self-approval)',
    description:
      'SuperAdmin bypasses independence checks; it may perform every stage itself. Required data and workflow states still apply. ' +
      'Requires `Idempotency-Key`. 403 SEPARATION_OF_DUTIES for the author; 422 VERSION_OVERLAP when an approved version starts at or after it; the open approved version ends where this one starts.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async approve(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<SourceStatusMappingV2View> {
    return toView(await this.mappings.approve(ctx, id));
  }
}
