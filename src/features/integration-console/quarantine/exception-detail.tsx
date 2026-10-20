import { Fragment, useState } from 'react';
import type { IngestionExceptionDetailView } from '@/api/v2/types/integrations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { EXCEPTION_STATE_LABELS, labelOf } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { SourceRef } from '../components/source-ref';
import { BindSourceDialog } from '../mapping/bind-source-dialog';
import { bindTargetOf, ERROR_CODE_INFO, exceptionFacts, type BindTarget } from '../model/exception-flow';
import { ExceptionActions } from './exception-actions';

export interface ExceptionDetailProps {
  exception: IngestionExceptionDetailView;
  connectionName: string;
  timezone: string;
}

function TechnicalDetail({ exception }: { exception: IngestionExceptionDetailView }) {
  return (
    <div className="space-y-2">
      <details>
        <summary className="cursor-pointer text-sm">Recorded detail</summary>
        <pre className="max-h-48 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(exception.detail, null, 2)}</pre>
      </details>
      {exception.raw?.payloadVisible ? (
        <details data-testid="raw-payload">
          <summary className="cursor-pointer text-sm">Raw payload (credential-like keys redacted)</summary>
          <pre className="max-h-64 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(exception.raw.payload, null, 2)}</pre>
        </details>
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="raw-payload-hidden">
          The raw payload is shown to integration administrators and manager approvers only.
        </p>
      )}
    </div>
  );
}

/**
 * One quarantined delivery: what failed and the usual fix, what the server recorded (placement,
 * diagnostics), the raw payload when the role may see it (redacted of credentials), and the actions:
 * bind the source, dry-run replay, replay, irrecoverable.
 */
export function ExceptionDetail({ exception, connectionName, timezone }: ExceptionDetailProps) {
  const { canWriteIntegration } = useCapabilities();
  const [bindTarget, setBindTarget] = useState<BindTarget | null>(null);
  const [bound, setBound] = useState<string | null>(null);
  const info = ERROR_CODE_INFO[exception.errorCode];
  const canBind = exception.errorCode === 'unknown_unit' && exception.state === 'open' && canWriteIntegration;
  return (
    <div className="space-y-6" data-testid="exception-detail" data-state={exception.state} data-code={exception.errorCode}>
      <Section title="What happened">
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="destructive">{info.label}</Badge>
            <Badge variant="outline">{labelOf(EXCEPTION_STATE_LABELS, exception.state)}</Badge>
          </div>
          <p>{info.suggestion}</p>
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">Connection</dt>
            <dd>{connectionName}</dd>
            <dt className="text-muted-foreground">Source object</dt>
            <dd><SourceRef value={exception.sourceObjectId} /></dd>
            {exceptionFacts(exception).map((fact) => (
              <Fragment key={fact.label}>
                <dt className="text-muted-foreground">{fact.label}</dt>
                <dd className="break-all" data-testid="exception-fact">{fact.value}</dd>
              </Fragment>
            ))}
            <dt className="text-muted-foreground">Occurrences</dt>
            <dd>{exception.occurrences}</dd>
            <dt className="text-muted-foreground">First seen</dt>
            <dd><PlantTime iso={exception.firstSeen} tz={timezone} withDate /></dd>
            <dt className="text-muted-foreground">Last seen</dt>
            <dd><PlantTime iso={exception.lastSeen} tz={timezone} withDate /></dd>
          </dl>
        </div>
      </Section>
      {canWriteIntegration && (
        <Section title="Resolve">
          <div className="space-y-3">
            {canBind && (
              <Button size="sm" variant="outline" disabled={!bindTargetOf(exception)} onClick={() => setBindTarget(bindTargetOf(exception))} data-testid="exception-bind">
                Bind source to a unit
              </Button>
            )}
            {bound && (
              <p role="status" className="text-sm" data-testid="exception-bound">
                {bound}
              </p>
            )}
            <ExceptionActions key={exception.id} exception={exception} />
          </div>
        </Section>
      )}
      <Section title="Technical detail">
        <TechnicalDetail exception={exception} />
      </Section>
      <BindSourceDialog connectionId={exception.connectionId} target={bindTarget} onClose={() => setBindTarget(null)} onBound={(mapping) => setBound(`Bound ${mapping.matchValue}; dry-run and replay to apply it.`)} />
    </div>
  );
}
