import { HistorianProvider } from '../../HistorianProvider';
import { StreamDescriptor, TimeSeriesPoint, TimeSeriesQuery, TimeSeriesResult } from '../../types';
import { PIClient } from '@/services/pi/PIClient';

export class PIHistorianProvider implements HistorianProvider {
  private client: PIClient;
  constructor(client: PIClient) {
    this.client = client;
  }

  key(): string { return 'pi'; }

  async resolveStreamsByAttributes(attributes: any[]): Promise<StreamDescriptor[]> {
    const results: StreamDescriptor[] = [];
    for (const a of attributes) {
      try {
        const streamWebId = await this.client.resolveAttributeStreamWebId(a);
        if (streamWebId) {
          results.push({ id: streamWebId, name: a?.Name, path: a?.Path, units: a?.DefaultUnitsName });
        }
      } catch {}
    }
    return results;
  }

  async query(q: TimeSeriesQuery): Promise<TimeSeriesResult[]> {
    const out: TimeSeriesResult[] = [];
    for (const s of q.streams) {
      let items: any[] = [];
      if (q.mode === 'recorded') {
        const res = await this.client.getStreamRecorded(s.id, {
          startTimeUtc: q.startTimeUtc,
          endTimeUtc: q.endTimeUtc,
          maxCount: q.maxCount,
          boundaryType: q.boundaryType,
          includeBad: q.includeBad,
          filter: q.filter,
        });
        items = res?.Items ?? [];
      } else if (q.mode === 'interpolated') {
        const res = await this.client.getStreamInterpolated(s.id, {
          startTimeUtc: q.startTimeUtc,
          endTimeUtc: q.endTimeUtc,
          interval: q.interval || '1m',
          filter: q.filter,
        });
        items = res?.Items ?? [];
      } else if (q.mode === 'plot') {
        const res = await this.client.getStreamPlot(s.id, {
          startTimeUtc: q.startTimeUtc,
          endTimeUtc: q.endTimeUtc,
          intervals: q.intervals || 300,
        });
        items = res?.Items ?? [];
      } else if (q.mode === 'summary') {
        const res = await this.client.getStreamSummary(s.id, {
          startTimeUtc: q.startTimeUtc,
          endTimeUtc: q.endTimeUtc,
          summaryTypes: q.summaryTypes || 'Average;Minimum;Maximum;Total;Count',
          calculationBasis: q.calculationBasis,
          timeType: q.timeType,
          interval: q.interval,
        });
        // Summary comes in a different shape; normalize to points with pseudo-timestamps
        const summaries: any[] = res?.Items ?? [];
        const points: TimeSeriesPoint[] = [];
        for (const sum of summaries) {
          const type = sum?.Type || sum?.SummaryType || 'Summary';
          const v = sum?.Value?.Value ?? sum?.Value;
          const ts = sum?.Value?.Timestamp || q.endTimeUtc;
          points.push({ timestamp: ts, value: typeof v === 'object' ? null : v, units: s.units });
        }
        out.push({ stream: s, points });
        continue;
      }
      const points: TimeSeriesPoint[] = items.map((it: any) => ({
        timestamp: it.Timestamp || it?.Value?.Timestamp || q.endTimeUtc,
        value: (it?.Value?.Value !== undefined) ? it.Value.Value : (it?.Value !== undefined ? it.Value : null),
        quality: { good: it?.Good, questionable: it?.Questionable, substituted: it?.Substituted },
        units: s.units,
      }));

      // Quality summary
      const samples = points.length;
      const good = points.filter(p => p.quality?.good).length;
      const questionable = points.filter(p => p.quality?.questionable).length;
      const substituted = points.filter(p => p.quality?.substituted).length;
      const qualitySummary = {
        samples,
        pctGood: samples ? (good / samples) * 100 : 0,
        pctQuestionable: samples ? (questionable / samples) * 100 : 0,
        pctSubstituted: samples ? (substituted / samples) * 100 : 0,
        lastSampleTime: points[samples - 1]?.timestamp,
      };

      out.push({ stream: s, points, qualitySummary });
    }
    return out;
  }
}

