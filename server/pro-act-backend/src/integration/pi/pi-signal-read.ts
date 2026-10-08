import { Injectable } from '@nestjs/common';
import { ReadPage, ReadRequest } from '../../intake/adapters/adapter.interface';
import { IntegrationConnection } from '../../intake/entities/integration-connection.entity';
import { Signal } from '../../signals/entities/signal.entity';
import { SignalsService } from '../../signals/signals.service';
import { PiSource } from './pi-frame-reader';
import { PiRecordedRead } from './pi-recorded-read';
import { invalid, parsePiSignalScope, PiSignalScope } from './pi-signal-scope';
import { PiStreamUpdates } from './pi-stream-updates';
import { assertSummaryBasis, PiSummaryRead } from './pi-summary-read';

/**
 * Signal jobs of the PI adapter (plan 1.7): resolves the job's signals on the connection and hands the
 * read to the mode's reader. `check` is the same validation the job creation runs (422 there, a failed
 * job at read time): every listed signal must belong to the connection, summaries only for rate
 * signals with a confirmed timebase, stream updates only while the connection supports them.
 */
@Injectable()
export class PiSignalRead {
  constructor(
    private readonly signals: SignalsService,
    private readonly recorded: PiRecordedRead,
    private readonly summaries: PiSummaryRead,
    private readonly updates: PiStreamUpdates,
  ) {}

  async read(source: PiSource, request: ReadRequest): Promise<ReadPage> {
    const { scope, signals } = await this.check(
      request.connection,
      request.scope,
    );
    const input = { scope, signals };
    if (scope.mode === 'summary')
      return this.summaries.read(source, request, input);
    if (scope.mode === 'updates')
      return this.updates.read(source, request, input);
    return this.recorded.read(source, request, input);
  }

  async check(
    connection: IntegrationConnection,
    raw: Readonly<Record<string, unknown>>,
  ): Promise<{ scope: PiSignalScope; signals: Signal[] }> {
    const scope = parsePiSignalScope(raw);
    const signals = await this.signals.forConnection(
      connection.tenantId,
      connection.id,
      scope.signalIds,
    );
    const missing = scope.signalIds.filter(
      (id) => !signals.some((signal) => signal.id === id),
    );
    if (missing.length > 0) {
      throw invalid(
        `signals not found on this connection: ${missing.join(', ')}`,
      );
    }
    if (signals.length === 0) throw invalid('the connection has no signals');
    if (scope.mode === 'summary') assertSummaryBasis(signals, scope);
    if (
      scope.mode === 'updates' &&
      connection.capabilities.streamUpdates === false
    ) {
      throw invalid(
        'the connection has no stream updates (capability streamUpdates = false)',
      );
    }
    return { scope, signals };
  }
}
