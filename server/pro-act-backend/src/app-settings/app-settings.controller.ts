import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiBody, ApiOperation } from '@nestjs/swagger';
import { AppSettingsService } from './app-settings.service';
import { AppSettings } from './app-settings.entity';
import { CreateAppSettingsDto } from './dto/create-app-settings.dto';
import { UpdateAppSettingsDto } from './dto/update-app-settings.dto';
import { Ctx } from '../common/context/ctx.decorator';
import { RequestContext } from '../common/context/request-context';
import { ReadOnlyAllowed } from '../auth/decorators/read-only-allowed.decorator';

/**
 * Settings scoped by owner (plan 3.11): application-wide keys are SuperAdmin-only to change, tenant keys
 * tenant-admin-only, per-user keys (`tabVisibility.<tenant>.<user>`) their user's or SuperAdmin's. A row the caller
 * may not read answers as missing; a write it may not make is 403 `SETTING_NOT_WRITABLE`.
 */
@ApiTags('App Settings')
@ApiBearerAuth()
@Controller('app-settings')
export class AppSettingsController {
  constructor(private readonly settingsService: AppSettingsService) {}

  @Get()
  findAll(@Ctx() ctx: RequestContext): Promise<AppSettings[]> {
    return this.settingsService.findAll(ctx);
  }

  @Get(':key')
  findOne(
    @Param('key') key: string,
    @Ctx() ctx: RequestContext,
  ): Promise<AppSettings | null> {
    return this.settingsService.findOne(key, ctx);
  }

  @Post()
  @ApiBody({ type: CreateAppSettingsDto })
  create(
    @Body() data: CreateAppSettingsDto,
    @Ctx() ctx: RequestContext,
  ): Promise<AppSettings> {
    return this.settingsService.create(data, ctx);
  }

  @Put(':key')
  @ApiBody({ type: UpdateAppSettingsDto })
  update(
    @Param('key') key: string,
    @Body() data: UpdateAppSettingsDto,
    @Ctx() ctx: RequestContext,
  ): Promise<AppSettings | null> {
    return this.settingsService.update(key, data, ctx);
  }

  @Delete(':key')
  remove(@Param('key') key: string, @Ctx() ctx: RequestContext): Promise<void> {
    return this.settingsService.remove(key, ctx);
  }

  // A viewer may keep its own preferences; the service refuses every key it does not own
  @Post(':key/value')
  @ReadOnlyAllowed()
  @ApiOperation({
    summary:
      'Set a value (own per-user keys for every role; others need their admin)',
  })
  setValue(
    @Param('key') key: string,
    @Body() body: { value: unknown },
    @Ctx() ctx: RequestContext,
  ): Promise<AppSettings> {
    return this.settingsService.setValue(key, body.value, ctx);
  }

  @Get(':key/value')
  getValue(
    @Param('key') key: string,
    @Ctx() ctx: RequestContext,
  ): Promise<unknown> {
    return this.settingsService.getValue(key, ctx);
  }
}
