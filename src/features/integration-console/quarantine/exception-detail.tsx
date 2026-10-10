import { useState } from 'react';
import { useIngestionException } from '@/api/v2/queries/ingestion-exceptions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { BindSourceDialog } from '../mapping/bind-source-dialog';
import { bindTargetOf, ERROR_CODE_INFO, type BindTarget } from '../model/exception-flow';
import { ExceptionActions } from './exception-actions';

export interface ExceptionDetailProps {
  id: string;
  timezone: string;
}

/**
 * One quarantined delivery: what failed and the usual fix, what the server recorded (placement,
 * diagnostics), the raw payload when the role may see it (redacted of credentials), and the actions:
 * bind the source, dry-run replay, replay, irrecoverable.
 */
export function ExceptionDetail({ id, timezone }: ExceptionDetailProps) {
  const query = useIngestionException(id);
  const [bindTarget, setBindTarget] = useState<BindTarget | null>(null);
  const [bound, setBound] = useState<string | null>(null);
  const exception = query.data;
  return (
    <DataState state={dataStateOf(query)} error={query.error}>
      {exception && (
        <section aria-label="Quarantined item" className="space-y-3 rounded-md border p-3 text-sm" data-testid="exception-detail" data-state={exception.state} data-code={exception.errorCode}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="destructive">{exception.errorCode}</Badge>
            <span className="font-medium">{ERROR_CODE_INFO[exception.errorCode].label}</span>
            <Badge variant="outline">{exception.state}</Badge>
          </div>
          <p>{ERROR_CODE_INFO[exception.errorCode].suggestion}</p>
          <p className="text-xs text-muted-foreground">
            Source object {exception.sourceObjectId} · {exception.occurrences} occurrence(s) · first <PlantTime iso={exception.firstSeen} tz={timezone} withDate /> · last{' '}
            <PlantTime iso={exception.lastSeen} tz={timezone} withDate />
          </p>
          <details>
            <summary className="cursor-pointer text-xs">Recorded detail</summary>
            <pre className="max-h-48 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(exception.detail, null, 2)}</pre>
          </details>
          {exception.raw?.payloadVisible ? (
            <details data-testid="raw-payload">
              <summary className="cursor-pointer text-xs">Raw payload (credential-like keys redacted)</summary>
              <pre className="max-h-64 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(exception.raw.payload, null, 2)}</pre>
            </details>
          ) : (
            <p className="text-xs text-muted-foreground" data-testid="raw-payload-hidden">
              The raw payload is shown to integration administrators and manager approvers only.
            </p>
          )}
          {exception.errorCode === 'unknown_unit' && exception.state === 'open' && (
            <Button size="sm" variant="outline" disabled={!bindTargetOf(exception)} onClick={() => setBindTarget(bindTargetOf(exception))} data-testid="exception-bind">
              Bind source to a unit
            </Button>
          )}
          {bound && (
            <p role="status" data-testid="exception-bound">
              {bound}
            </p>
          )}
          <ExceptionActions key={exception.id} exception={exception} />
          <BindSourceDialog connectionId={exception.connectionId} target={bindTarget} onClose={() => setBindTarget(null)} onBound={(mapping) => setBound(`Bound ${mapping.matchValue}; dry-run and replay to apply it.`)} />
        </section>
      )}
    </DataState>
  );
}
