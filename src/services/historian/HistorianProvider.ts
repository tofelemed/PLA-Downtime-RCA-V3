import { TimeSeriesQuery, TimeSeriesResult, StreamDescriptor } from './types';

export interface HistorianProvider {
  key(): string;
  resolveStreamsByAttributes?(attributes: any[]): Promise<StreamDescriptor[]>;
  describeStream?(streamId: string): Promise<StreamDescriptor | null>;
  query(q: TimeSeriesQuery): Promise<TimeSeriesResult[]>;
}

