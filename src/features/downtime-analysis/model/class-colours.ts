import type { ScheduleClass } from './downtime-filters';

export interface ClassColour {
  /** chart fill (Recharts) */
  chart: string;
  /** Tailwind background class (timeline bars, legend swatches) */
  fill: string;
}

/**
 * Schedule-class colours of the downtime charts and the stop timeline (tokens only): unplanned = loss red,
 * planned = neutral slate (as on the dashboard), external = amber (outside causes: starved / blocked),
 * not classified = light grey (hatched on the timeline, so it never relies on the fill alone).
 */
export const CLASS_COLOURS: Readonly<Record<ScheduleClass, ClassColour>> = {
  unplanned: { chart: 'hsl(var(--danger))', fill: 'bg-danger' },
  planned: { chart: 'hsl(var(--chart-8))', fill: 'bg-chart-8' },
  external: { chart: 'hsl(var(--state-starved))', fill: 'bg-state-starved' },
  unknown: { chart: 'hsl(var(--state-unknown))', fill: 'bg-state-unknown bg-hatch-unknown' },
};
