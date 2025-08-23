import { HistorianProvider } from './HistorianProvider';
import { TimeSeriesQuery, TimeSeriesResult } from './types';

export class HistorianClient {
  private providers: Map<string, HistorianProvider> = new Map();

  register(provider: HistorianProvider) {
    this.providers.set(provider.key(), provider);
  }

  hasProvider(key: string): boolean {
    return this.providers.has(key);
  }

  async query(q: TimeSeriesQuery): Promise<TimeSeriesResult[]> {
    const p = this.providers.get(q.provider);
    if (!p) throw new Error(`Historian provider not registered: ${q.provider}`);
    return p.query(q);
  }
}

