import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { ToneBadge } from '../components/tone-badge';
import { classifyToken, type Classification, type ValueMapKind } from './model/value-map-classify';

export interface ValueMapProbeProps {
  kind: ValueMapKind;
  map: Readonly<Record<string, string>>;
  keepUnmapped?: boolean;
}

function describe(result: Classification, kind: ValueMapKind): { tone: 'ok' | 'warning' | 'error' | 'idle'; text: string } {
  switch (result.outcome) {
    case 'mapped':
      return { tone: 'ok', text: `"${result.token}" → ${result.value}${result.exact ? '' : ' (matched case-insensitively)'}` };
    case 'passthrough':
      return { tone: 'warning', text: `no ${kind} map: "${result.token}" passes through as itself (unmapped)` };
    case 'unmapped':
      return result.consequence === 'kept_raw'
        ? { tone: 'warning', text: `${result.reason} → kept as raw token "${result.token}" (event created uncoded)` }
        : { tone: 'error', text: `${result.reason} → quarantined as unmapped_value` };
    case 'no_token':
      return { tone: 'error', text: `${result.reason} → quarantined as unmapped_value` };
  }
}

/** Type a raw token, see what the running adapter would make of it with the map as drafted. */
export function ValueMapProbe({ kind, map, keepUnmapped }: ValueMapProbeProps) {
  const [raw, setRaw] = useState('');
  const result = raw.trim() === '' ? null : classifyToken(map, raw, { kind, keepUnmappedReason: keepUnmapped });
  const shown = result ? describe(result, kind) : null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" data-testid={`${kind}-probe`}>
      <label htmlFor={`${kind}-probe-input`} className="text-muted-foreground">
        Try a raw token
      </label>
      <Input id={`${kind}-probe-input`} className="h-8 w-48 font-mono" placeholder={kind === 'state' ? 'RUN or 2 or {"name":"RUN"}' : 'E101'} value={raw} onChange={(event) => setRaw(event.target.value)} />
      {shown && (
        <ToneBadge tone={shown.tone} testId={`${kind}-probe-result`}>
          {shown.text}
        </ToneBadge>
      )}
    </div>
  );
}
