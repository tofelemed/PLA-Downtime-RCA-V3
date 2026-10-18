import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull, Not } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { notFound } from '../profiles/profile-errors';
import { requireUser } from '../reconciliation/revision-access';
import { keysetPage } from '../v2/common/keyset-page';
import { UserNotification } from './entities/user-notification.entity';

/** `active`: work still open and information (the bell); `resolved`: work someone already did (history). */
export type NotificationState = 'active' | 'resolved' | 'all';

export interface NotificationPageQuery {
  cursor?: string;
  limit: number;
  unreadOnly: boolean;
  state: NotificationState;
}

/**
 * The signed-in user's in-app notifications in the acting plant (EXPERT_REVIEW Area 3): newest first
 * (keyset on `IDX_user_notifications_user_created` / `_user_active`), the unread count of the active ones,
 * and read / unread marks. Active = not resolved: a shared work item someone already did is history. A user
 * only ever sees and marks their own rows (404 for anyone else's).
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
    if (query.state === 'active') qb.andWhere('n.resolvedAt IS NULL');
    if (query.state === 'resolved') qb.andWhere('n.resolvedAt IS NOT NULL');
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
      .countBy({ ...owner, readAt: IsNull(), resolvedAt: IsNull() });
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

  /** Marks one of the caller's notifications unread again (a reminder to come back to it). */
  async markUnread(
    context: RequestContext,
    id: string,
  ): Promise<UserNotification> {
    const owner = this.ownerOf(context);
    const repository = this.dataSource.getRepository(UserNotification);
    const found = await repository.findOneBy({ id, ...owner });
    if (!found) throw notFound('Notification');
    if (!found.readAt) return found;
    await repository.update(
      { id, ...owner, readAt: Not(IsNull()) },
      { readAt: null, updatedBy: owner.userId },
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
