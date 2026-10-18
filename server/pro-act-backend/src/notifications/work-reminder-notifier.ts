import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { enqueueOutbox } from '../common/outbox/outbox-writer';
import { longStopRows, uncodedBacklogRows } from './downtime-alerts';
import { HolderCache, insertNotifications } from './notification-rows';
import { roleHoldersOf } from './role-holders';
import { NOTIFICATIONS_CREATED } from './sla-escalation-notifier';
import { workItemRows } from './work-item-reminders';
import { WorkReminderConfig, workReminderConfig } from './work-reminder-config';

/**
 * Work and downtime reminders of one plant (item 6), in-app only: due / overdue RCA corrective actions
 * (owner, then the case team lead after 7 days) and tasks (assignee, then the assigner), uncoded stop
 * backlog per unit and production day (operators and production engineers of the unit) and long open stops
 * (production engineering and plant management of the unit). Idempotent like the SLA notifications:
 * `UQ_user_notifications_user_key` and ON CONFLICT DO NOTHING, so a rerun (or a second worker) adds nothing.
 * New rows publish one realtime hint per plant.
 */
@Injectable()
export class WorkReminderNotifier {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Notifications created for the plant at `asOf`. */
  notify(
    tenantId: string,
    asOf: Date,
    config: WorkReminderConfig = workReminderConfig(),
  ): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const holders = new HolderCache((role, unitId) =>
        roleHoldersOf(manager, { tenantId, role, unitId }),
      );
      const timings = {
        leadMs: config.dueLeadMs,
        escalateMs: config.overdueEscalateMs,
      };
      const work = { tenantId, asOf, lookbackMs: config.lookbackMs };
      const alerts = { tenantId, asOf, config, holders };
      const rows = [
        ...(await workItemRows(
          manager,
          { ...work, kind: 'rca_action' },
          timings,
        )),
        ...(await workItemRows(manager, { ...work, kind: 'task' }, timings)),
        ...(await uncodedBacklogRows(manager, alerts)),
        ...(await longStopRows(manager, alerts)),
      ];
      const created = await insertNotifications(manager, tenantId, rows);
      if (created > 0) {
        await enqueueOutbox(manager, [
          {
            tenantId,
            aggregateType: 'user_notification',
            aggregateId: tenantId,
            type: NOTIFICATIONS_CREATED,
            payload: { tenantId, created },
          },
        ]);
      }
      return created;
    });
  }
}
