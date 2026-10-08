import { Injectable } from '@nestjs/common';
import { ReadPage, ReadRequest } from '../../intake/adapters/adapter.interface';
import { Signal } from '../../signals/entities/signal.entity';
import { PiSource } from './pi-frame-reader';
import { parseSignalCursor } from './pi-signal-cursor';
import { piSummaryEnvelope } from './pi-signal-envelope';
import { invalid, PiSignalScope, RateTimebase } from './pi-signal-scope';
import { readTotals } from './pi-streams';

const MINUTE = 60_000;

/**
 * `summary` reads (PI09): time-weighted PI `Total`s per complete interval for rate signals only, and only
 * when the job confirms the timebase PI assumes for the total equals the signal's rate timebase (the
 * unit conversion is validated, never assumed). Per signal at most `pageSize` intervals per read; the
 * checkpoint is the end of the last interval read. Counters and other types are refused (a total of a
 * cumulative counter is meaningless).
 */
@Injectable()
export class PiSummaryRead {
  async read(
    source: PiSource,
    request: ReadRequest,
    input: { scope: PiSignalScope; signals: Signal[] },
  ): Promise<ReadPage> {
    const { scope, signals } = input;
    assertSummaryBasis(signals, scope);
    const cursor = parseSignalCursor(request.cursor);
    const now = new Date();
    const interval = scope.summaryMinutes * MINUTE;
    const end = Math.floor(now.getTime() / interval) * interval;
    const checkpoints = { ...cursor.checkpoints };
    const records: unknown[] = [];
    let hasMore = false;
    for (const signal of signals) {
      const checkpoint = cursor.checkpoints[signal.id];
      const start = checkpoint
        ? Date.parse(checkpoint)
        : end - scope.lookbackMinutes * MINUTE;
      const until = Math.min(end, start + request.pageSize * interval);
      if (start >= until) continue;
      records.push(
        ...(await this.totals(source, request, {
          signal,
          scope,
          start,
          until,
          now,
        })),
      );
      checkpoints[signal.id] = new Date(until).toISOString();
      hasMore = hasMore || until < end;
    }
    return { records, nextCursor: { checkpoints, window: null }, hasMore };
  }

  /** Envelopes of one signal's totals over `[start, until)`. */
  private async totals(
    source: PiSource,
    request: ReadRequest,
    input: {
      signal: Signal;
      scope: PiSignalScope;
      start: number;
      until: number;
      now: Date;
    },
  ): Promise<unknown[]> {
    const { signal, scope } = input;
    const interval = scope.summaryMinutes * MINUTE;
    const totals = await readTotals(source.client, {
      webId: signal.sourceKey,
      start: new Date(input.start).toISOString(),
      end: new Date(input.until).toISOString(),
      intervalMinutes: scope.summaryMinutes,
    });
    const binding = {
      tenantId: request.connection.tenantId,
      connectionId: request.connection.id,
    };
    const read = {
      webId: signal.sourceKey,
      at: input.now,
      correlationId: `pi-job:${request.jobId ?? 'adhoc'}:summary`,
    };
    const timebase = scope.totalTimebase as RateTimebase;
    return totals.map((total) =>
      piSummaryEnvelope(
        binding,
        {
          ...total,
          end: new Date(Date.parse(total.start) + interval).toISOString(),
          timebase,
        },
        read,
      ),
    );
  }
}

/** Refuses non-rate signals and a timebase that differs from the signal's (422 at job creation). */
export function assertSummaryBasis(
  signals: Signal[],
  scope: PiSignalScope,
): void {
  for (const signal of signals) {
    if (signal.semanticType !== 'rate') {
      throw invalid(
        `summary totals are for rate signals only; ${signal.id} is ${signal.semanticType}`,
      );
    }
    if (signal.rateTimebase !== scope.totalTimebase) {
      throw invalid(
        `totalTimebase ${scope.totalTimebase} differs from the rate timebase ${signal.rateTimebase} of ${signal.id}`,
      );
    }
  }
}
