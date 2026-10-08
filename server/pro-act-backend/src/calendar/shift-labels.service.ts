import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/** What the legacy label needs of an event. */
export interface LabelledEvent {
  id: string;
  unitId?: string | null;
  startTime?: Date | string | null;
  shift?: string | null;
}

/**
 * v1 bridge (plan 2.1 step 5): the `shift` of a legacy event is read from the shift instance of its unit
 * that contains its start, not from the free text stored on the row. Events with no unit, or whose start
 * no generated instance covers (no published calendar yet), keep the stored text. One query per page.
 */
@Injectable()
export class ShiftLabelsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async apply<T extends LabelledEvent>(events: T[]): Promise<T[]> {
    const keyed = events.filter((e) => e.unitId && e.startTime);
    if (keyed.length === 0) return events;
    const rows = await this.dataSource.query<
      Array<{ id: string; shift_name: string }>
    >(
      `SELECT e."id", si."shift_name"
         FROM unnest($1::uuid[], $2::uuid[], $3::timestamptz[]) AS e("id", "unit_id", "start_time")
         JOIN "shift_instances" si
           ON si."unit_id" = e."unit_id" AND si."utc_start" <= e."start_time" AND si."utc_end" > e."start_time"`,
      [
        keyed.map((e) => e.id),
        keyed.map((e) => e.unitId),
        keyed.map((e) => new Date(e.startTime as Date | string).toISOString()),
      ],
    );
    const labels = new Map(rows.map((row) => [row.id, row.shift_name]));
    for (const event of events) {
      const label = labels.get(event.id);
      if (label !== undefined) event.shift = label;
    }
    return events;
  }
}
