export type HistorianProviderKey = 'pi';

export type TimeSeriesMode = 'recorded' | 'interpolated' | 'summary' | 'plot';

export type QualityFlags = {
  good?: boolean;
  questionable?: boolean;
  substituted?: boolean;
};

export interface StreamDescriptor {
  id: string; // provider-specific stream identifier (e.g., PI Stream WebId)
  name?: string;
  path?: string;
  units?: string;
  dataType?: string;
}

export interface TimeSeriesPoint {
  timestamp: string; // ISO string (UTC)
  value: number | string | null;
  quality?: QualityFlags;
  units?: string;
}

export interface TimeSeriesResult {
  stream: StreamDescriptor;
  points: TimeSeriesPoint[];
  qualitySummary?: {
    samples: number;
    pctGood: number;
    pctQuestionable: number;
    pctSubstituted: number;
    lastSampleTime?: string;
  };
}

export interface TimeSeriesQuery {
  provider: HistorianProviderKey;
  streams: StreamDescriptor[]; // at least one
  mode: TimeSeriesMode;
  startTimeUtc: string;
  endTimeUtc: string;
  // recorded
  includeBad?: boolean;
  boundaryType?: 'Inside' | 'Outside' | 'Exact' | 'Interpolated';
  maxCount?: number;
  filter?: string;
  // interpolated/plot/summary
  interval?: string; // e.g., '1m', '5m'
  intervals?: number; // for plot
  summaryTypes?: string; // e.g., 'Average;Minimum;Maximum;Total;Count'
  calculationBasis?: 'TimeWeighted' | 'EventWeighted';
  timeType?: 'Auto' | 'EventWeighted' | 'TimeWeighted';
}

