import {
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
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { Ctx } from '../../common/context/ctx.decorator';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { UserNotification } from '../../notifications/entities/user-notification.entity';
import { NotificationsService } from '../../notifications/notifications.service';
import { ListQueryDto } from '../common/list-query.dto';
import { ListResponse, listResponse } from '../common/response';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';

export class NotificationListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: ['true', 'false'], description: 'Only unread' })
  @IsOptional()
  @IsIn(['true', 'false'])
  unread?: 'true' | 'false';

  @ApiPropertyOptional({ enum: ['-createdAt'] })
  @IsOptional()
  @IsIn(['-createdAt'])
  sort?: string = undefined;
}

export interface NotificationV2View {
  id: string;
  kind: string;
  entityType: string;
  entityId: string;
  /** structured content the client renders in plant time (e.g. period, unit, level, role) */
  detail: Record<string, unknown>;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

function toView(n: UserNotification): NotificationV2View {
  return {
    id: n.id,
    kind: n.kind,
    entityType: n.entityType,
    entityId: n.entityId,
    detail: n.detail,
    read: n.readAt !== null,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  };
}

/** The signed-in user's in-app notifications in the acting plant (SLA escalations, EXPERT_REVIEW Area 3). */
@ApiTags('v2 · Notifications')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'notifications', version: '2' })
export class NotificationsV2Controller {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'My notifications in the acting plant, newest first (keyset)',
  })
  async list(
    @Ctx() ctx: RequestContext,
    @Query() query: NotificationListQueryDto,
  ): Promise<ListResponse<NotificationV2View>> {
    const page = await this.notifications.page(ctx, {
      cursor: query.cursor,
      limit: query.limit,
      unreadOnly: query.unread === 'true',
    });
    return listResponse(page.items.map(toView), page.nextCursor, {
      tenantId: requireTenantId(ctx),
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'How many of my notifications are unread' })
  async unreadCount(@Ctx() ctx: RequestContext): Promise<{ unread: number }> {
    return { unread: await this.notifications.unreadCount(ctx) };
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all my unread notifications read' })
  async readAll(@Ctx() ctx: RequestContext): Promise<{ updated: number }> {
    return { updated: await this.notifications.markAllRead(ctx) };
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark one of my notifications read (404 for anyone else’s)',
  })
  async read(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<NotificationV2View> {
    return toView(await this.notifications.markRead(ctx, id));
  }
}
