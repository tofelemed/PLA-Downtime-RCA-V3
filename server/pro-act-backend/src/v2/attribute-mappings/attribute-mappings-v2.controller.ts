import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { ReadOnlyAllowed } from '../../auth/decorators/read-only-allowed.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  EVENT_FIELD_CATALOG,
  EventFieldCatalog,
} from '../../attribute-mapping/event-field-catalog';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  AttributeMappingPreviewService,
  AttributeMappingPreviewView,
} from './attribute-mapping-preview.service';
import {
  AttributeMappingPreviewV2Dto,
  AttributeMappingV2CreateDto,
} from './attribute-mapping-v2.dto';
import {
  AttributeMappingsV2Service,
  AttributeMappingVersionView,
  EffectiveTemplateMapping,
} from './attribute-mappings-v2.service';

class AttributeMappingQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Connection whose overrides apply',
  })
  @IsOptional()
  @IsUUID()
  connectionId?: string;
}

const MAPPING_WRITERS = ['integration_admin', 'manager_approver'] as const;

@ApiTags('v2 · Attribute Mappings')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ version: '2' })
export class AttributeMappingsV2Controller {
  constructor(
    private readonly service: AttributeMappingsV2Service,
    private readonly previews: AttributeMappingPreviewService,
  ) {}

  @Get('field-catalog')
  @ApiOperation({
    summary: 'The event field catalog (ING04)',
    description:
      'Every event field a source attribute may be mapped to, its accepted rule types and the default ' +
      'rules per PI template; the same list validates attribute mappings. Published copy: ' +
      'contracts/event-field-catalog.json.',
  })
  fieldCatalog(): EventFieldCatalog {
    return EVENT_FIELD_CATALOG;
  }

  @Get('attribute-mappings')
  @ApiOperation({
    summary: 'Effective attribute mapping per template',
    description:
      'Catalog defaults, merged field by field with the legacy pi_mappings overrides and the versioned ' +
      'tenant override in force (shown as `override`).',
  })
  effective(
    @Ctx() ctx: RequestContext,
    @Query() query: AttributeMappingQueryDto,
  ): Promise<EffectiveTemplateMapping[]> {
    return this.service.effective(ctx, query.connectionId ?? null);
  }

  @ReadOnlyAllowed()
  @Post('attribute-mappings/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Preview the typed mapping of one sample record (nothing is stored)',
    description:
      'Runs the intake mapping on the attributes with the effective rules of the template (catalog ' +
      'defaults < legacy < versioned override) and optional draft `fieldRules` merged per field: event ' +
      'columns, source facts (durations in seconds), diagnostics and the timestamp duration. 422 ' +
      'INVALID_FIELD_RULES for draft rules the catalog rejects.',
  })
  preview(
    @Ctx() ctx: RequestContext,
    @Body() body: AttributeMappingPreviewV2Dto,
  ): Promise<AttributeMappingPreviewView> {
    return this.previews.preview(ctx, body);
  }

  @Post('attribute-mappings')
  @Idempotent()
  @Roles(...MAPPING_WRITERS)
  @ApiOperation({
    summary: 'Add the next version of a template override',
    description:
      'Requires `Idempotency-Key`. Rules are validated against the field catalog (422 INVALID_FIELD_RULES: ' +
      'unknown field, type not accepted by the field, duration without unit, field mapped twice).',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  create(
    @Ctx() ctx: RequestContext,
    @Body() body: AttributeMappingV2CreateDto,
  ): Promise<AttributeMappingVersionView> {
    return this.service.createVersion(ctx, body);
  }
}
