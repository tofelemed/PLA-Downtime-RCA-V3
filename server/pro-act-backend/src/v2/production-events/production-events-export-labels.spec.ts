import { ProductionEvent } from '../../production-event/production-event.entity';
import { EXPORT_COLUMNS } from './production-events-export';
import {
  EXPORT_LABEL_COLUMNS,
  labelCells,
} from './production-events-export-labels';

const stop = {
  startTime: new Date('2026-10-17T04:30:00.000Z'),
  endTime: new Date('2026-10-17T05:30:00.000Z'),
  eventType: 'ProductionLoss',
  physicalType: 'downtime',
  scheduleClass: 'unplanned',
  oeeComponent: 'availability',
  physicalState: 'closed',
  codingState: 'uncoded',
  rcaState: 'none',
  sourceKind: 'derived',
} as unknown as ProductionEvent;

describe('event CSV words (QA audit L5)', () => {
  it('appends the plant-clock times and screen labels after the raw columns', () => {
    expect(EXPORT_COLUMNS.slice(-EXPORT_LABEL_COLUMNS.length)).toEqual([
      ...EXPORT_LABEL_COLUMNS,
    ]);
    expect(EXPORT_COLUMNS[0]).toBe('start_utc');
    expect(labelCells(stop, 'Asia/Tehran')).toEqual([
      '2026-10-17T08:00:00+03:30',
      '2026-10-17T09:00:00+03:30',
      'Production loss',
      'Downtime',
      'Unplanned',
      'Availability',
      'Ended',
      'Uncoded',
      'No investigation',
      'Derived',
    ]);
  });

  it('leaves the plant time empty for an open event or without a zone; unknown keys read as words', () => {
    const open = {
      ...stop,
      endTime: null,
      eventType: 'NEW_KIND',
    } as unknown as ProductionEvent;
    const cells = labelCells(open, null);
    expect(cells[0]).toBeNull();
    expect(cells[1]).toBeNull();
    expect(cells[2]).toBe('NEW KIND');
  });
});
