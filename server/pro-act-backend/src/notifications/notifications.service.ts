import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { notFound } from '../profiles/profile-errors';
import { requireUser } from '../reconciliation/revision-access';
import { keysetPage } from '../v2/common/keyset-page';
import { UserNotification } from './entities/user-notification.entity';

export interface NotificationPageQuery {
  cursor?: string;
  limit: number;
  unreadOnly: boolean;
}

/**
 * The signed-in user's in-app notifications in the acting plant (EXPERT_REVIEW Area 3): newest first
 * (keyset on `IDX_user_notifications_user_created`), the unread count, and read marks. A user only ever
 * sees and marks their own rows (404 for anyone else's).
 */
@Injectable()
export class NotificationsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async page(
    context: RequestContext,
    query: NotificationPageQuery,
  ): Promise<{ items: UserNotification[]; nextCursor: string | null }> {
    const owner = this.ownerOf(context);
    const qb = this.dataSource
      .getRepository(UserNotification)
      .createQueryBuilder('n')
      .where('n.tenantId = :tenantId AND n.userId = :userId', owner);
    if (query.unreadOnly) qb.andWhere('n.readAt IS NULL');
    return keysetPage(qb, {
      alias: 'n',
      property: 'createdAt',
      direction: 'DESC',
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  unreadCount(context: RequestContext): Promise<number> {
    const owner = this.ownerOf(context);
    return this.dataSource
      .getRepository(UserNotification)
      .countBy({ ...owner, readAt: IsNull() });
  }

  async markRead(
    context: RequestContext,
    id: string,
  ): Promise<UserNotification> {
    const owner = this.ownerOf(context);
    const repository = this.dataSource.getRepository(UserNotification);
    const found = await repository.findOneBy({ id, ...owner });
    if (!found) throw notFound('Notification');
    if (found.readAt) return found;
    await repository.update(
      { id, ...owner, readAt: IsNull() },
      { readAt: new Date(), updatedBy: owner.userId },
    );
    return repository.findOneByOrFail({ id });
  }

  /** Marks every unread notification of the caller in the plant read; returns how many changed. */
  async markAllRead(context: RequestContext): Promise<number> {
    const owner = this.ownerOf(context);
    const result = await this.dataSource
      .getRepository(UserNotification)
      .update(
        { ...owner, readAt: IsNull() },
        { readAt: new Date(), updatedBy: owner.userId },
      );
    return result.affected ?? 0;
  }

  private ownerOf(context: RequestContext): {
    tenantId: string;
    userId: string;
  } {
    return { tenantId: requireTenantId(context), userId: requireUser(context) };
  }
}
