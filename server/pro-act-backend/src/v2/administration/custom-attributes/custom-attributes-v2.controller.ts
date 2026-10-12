import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { Ctx } from '../../../common/context/ctx.decorator';
import { RequestContext } from '../../../common/context/request-context';
import { Idempotent } from '../../../common/idempotency/idempotent.decorator';
import { ListResponse } from '../../common/response';
import { TenantQueryParamGuard } from '../../common/tenant-query-param.guard';
import { ATTRIBUTE_WRITERS } from '../administration-roles';
import { AttributeDefinitionV2View } from './attribute-definition-v2.view';
import {
  AttributeDefinitionsQueryDto,
  CreateAttributeDefinitionDto,
  UpdateAttributeDefinitionDto,
} from './custom-attributes-v2.dto';
import { CustomAttributesV2Service } from './custom-attributes-v2.service';

/** Custom attribute definitions per hierarchy level (organization, plant, unit, asset). */
@ApiTags('v2 · Custom attributes')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'custom-attribute-definitions', version: '2' })
export class CustomAttributesV2Controller {
  constructor(private readonly attributes: CustomAttributesV2Service) {}

  @Get()
  @ApiOperation({
    summary:
      'Definitions that apply in the acting plant, in display order (keyset)',
    description:
      'The plant’s own, its organization’s and the shared ones. `editable` says whether you may change it.',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: AttributeDefinitionsQueryDto,
  ): Promise<ListResponse<AttributeDefinitionV2View>> {
    return this.attributes.list(ctx, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'One definition (404 when it does not apply in the plant)',
  })
  get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AttributeDefinitionV2View> {
    return this.attributes.get(ctx, id);
  }

  @Post()
  @Roles(...ATTRIBUTE_WRITERS)
  @Idempotent()
  @ApiOperation({
    summary:
      'Create a definition for the acting plant (requires Idempotency-Key)',
    description:
      '409 ATTRIBUTE_EXISTS when the level already has this internal name.',
  })
  create(
    @Ctx() ctx: RequestContext,
    @Body() body: CreateAttributeDefinitionDto,
  ): Promise<AttributeDefinitionV2View> {
    return this.attributes.create(ctx, body);
  }

  @Patch(':id')
  @Roles(...ATTRIBUTE_WRITERS)
  @ApiOperation({
    summary: 'Change a definition',
    description:
      '403 ATTRIBUTE_NOT_EDITABLE for a shared definition unless you are a super administrator.',
  })
  update(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateAttributeDefinitionDto,
  ): Promise<AttributeDefinitionV2View> {
    return this.attributes.update(ctx, id, body);
  }

  @Delete(':id')
  @Roles(...ATTRIBUTE_WRITERS)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a definition and every value stored for it',
  })
  remove(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.attributes.remove(ctx, id);
  }
}
