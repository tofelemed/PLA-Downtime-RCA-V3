import type { DowntimeView } from '@/features/analysis-navigation/analysis-pages';

export interface DowntimeModeOption {
  value: string;
  label: string;
}

export interface DowntimeModeSpec {
  /** URL parameter that keeps the choice */
  param: string;
  label: string;
  options: readonly DowntimeModeOption[];
}

/** The focused analysis of each page (the "what" field of the filter row); the first option is the default. */
export const DOWNTIME_MODES: Readonly<Partial<Record<DowntimeView, DowntimeModeSpec>>> = {
  stops: {
    param: 'presentation',
    label: 'Show',
    options: [
      { value: 'list', label: 'Stop records' },
      { value: 'timeline', label: 'State timeline' },
    ],
  },
  causes: {
    param: 'analysis',
    label: 'Rank by',
    options: [
      { value: 'lost-production', label: 'Lost production' },
      { value: 'reasons', label: 'Downtime reasons' },
      { value: 'assets', label: 'Assets / bad actors' },
    ],
  },
  trends: {
    param: 'comparison',
    label: 'Compare',
    options: [
      { value: 'trend', label: 'Time trend' },
      { value: 'crew', label: 'Crew comparison' },
      { value: 'calendar', label: 'Previous-period comparison' },
    ],
  },
};
