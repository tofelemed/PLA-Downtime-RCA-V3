import { useState } from 'react';
import { v2Request } from '@/api/v2/client';
import { useV2Command } from '@/api/v2/queries/use-v2-command';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DateTimeInput } from '@/features/ux-kit/date-inputs';
import { ConsoleRefusal } from '../components/console-refusal';
import { labelOf, SIGNAL_TYPE_LABELS } from '@/features/ux-kit/labels';
import { profileKindLabel } from './model/profile-labels';

interface SampleResult { ok: boolean; code?: string; detail?: string; kind?: string; observedAt?: string; sourceKey?: string | null; bindingStatus?: string; binding?: { signalId: string; name: string; unitId: string; semanticType: string; canonicalUom: string | null } | null; quality?: unknown; values?: unknown }
interface Packet { topic: string; payload: string; receivedAt: string; retained: boolean }
export function MqttSamplePreview({ connectionId, timezone }: { connectionId: string; timezone: string }) {
  const [topic, setTopic] = useState('');
  const [payload, setPayload] = useState('');
  const [receivedAt, setReceivedAt] = useState<string | null>(null);
  const [retained, setRetained] = useState(false);
  const preview = useV2Command<Packet, SampleResult>({
    run: async ({ input }) => (await v2Request<SampleResult>({ method: 'POST', path: `/connections/${connectionId}/mqtt-preview`, body: input })).data,
    changes: () => null,
  });
  return <section className="space-y-3 rounded border p-3" aria-label="Validate MQTT sample">
    <h3 className="font-medium">Validate MQTT sample</h3>
    <p className="text-sm text-muted-foreground">Paste a real packet and its receive time. This checks the saved profile, time, quality, identity and effective signal binding. It writes no samples or events. Edit the payload profile first if your source uses other field paths.</p>
    <label className="block space-y-1 text-sm">Topic<Input maxLength={1000} value={topic} onChange={(e) => setTopic(e.target.value)} /></label>
    <label className="block space-y-1 text-sm">Payload JSON<Textarea maxLength={65536} rows={8} value={payload} onChange={(e) => setPayload(e.target.value)} /></label>
    <DateTimeInput label="Sample receive time" timeZone={timezone} value={receivedAt} onChange={setReceivedAt} />
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={retained} onChange={(e) => setRetained(e.target.checked)} />Retained message</label>
    <Button variant="outline" disabled={!topic.trim() || !payload.trim() || !receivedAt || preview.isPending} onClick={() => { if (receivedAt) void preview.submit({ topic, payload, receivedAt, retained }).catch(() => null); }}>Validate sample (no writes)</Button>
    <ConsoleRefusal error={preview.error} />
    {preview.data && <div className="space-y-1 text-sm" aria-live="polite">
      <p>{preview.data.ok ? `Decoded ${profileKindLabel(preview.data.kind ?? '')}: ${preview.data.bindingStatus?.replace(/_/g, ' ')}` : `${preview.data.code}: ${preview.data.detail}`}</p>
      {preview.data.sourceKey && <p className="break-all">Source key: {preview.data.sourceKey}</p>}
      {preview.data.binding && <p>Signal: {preview.data.binding.name} ({labelOf(SIGNAL_TYPE_LABELS, preview.data.binding.semanticType)}, {preview.data.binding.canonicalUom ?? 'no quantity unit'})</p>}
      {preview.data.ok && <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">{JSON.stringify({ observedAt: preview.data.observedAt, quality: preview.data.quality, values: preview.data.values }, null, 2)}</pre>}
      <p className="text-xs text-muted-foreground">Sample decoding does not prove live delivery, event mappings, unit-state rules, source priority or period accounting. Check those below and in the period workspace.</p>
    </div>}
  </section>;
}
