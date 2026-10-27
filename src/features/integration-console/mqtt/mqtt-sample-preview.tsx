import { useState } from 'react';
import { v2Request } from '@/api/v2/client';
import { useV2Command } from '@/api/v2/queries/use-v2-command';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DateTimeInput } from '@/features/ux-kit/date-inputs';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { ConsoleRefusal } from '../components/console-refusal';
import { NativeSelect } from '../components/native-select';
import { labelOf, SIGNAL_TYPE_LABELS } from '@/features/ux-kit/labels';
import { examplePayloadText, type FeedForm } from './model/feeds';
import { FEED_PURPOSE_LABELS } from './model/feed-templates';
import { profileKindLabel } from './model/profile-labels';
import { bindingStatusLabel, sampleTopicOf, type PreviewFeed } from './model/preview-figures';
import { PreviewFigures } from './preview-figures-list';

interface SampleResult { ok: boolean; code?: string; detail?: string; kind?: string; observedAt?: string; sourceKey?: string | null; bindingStatus?: string; binding?: { signalId: string; name: string; unitId: string; semanticType: string; canonicalUom: string | null } | null; feed?: PreviewFeed | null; quality?: unknown; values?: unknown }
const SAMPLE_INFO = 'Paste a real packet and its receive time. This checks the saved profile, time, quality, identity and effective signal binding; it writes no samples or events. Edit the payload profile first if your source uses other field paths. Sample decoding does not prove live delivery, event mappings, unit-state rules, source priority or period accounting.';
interface Packet { topic: string; payload: string; receivedAt: string; retained: boolean }

export interface MqttSamplePreviewProps {
  connectionId: string;
  timezone: string;
  /** feeds of a feeds connection: a "Purpose" quick-fill puts a feed topic and its example in place */
  feeds?: readonly FeedForm[] | null;
}

function FeedQuickFill({ feeds, onPick }: { feeds: readonly FeedForm[]; onPick: (feed: FeedForm) => void }) {
  const [chosen, setChosen] = useState('');
  return (
    <div className="space-y-1 text-sm">
      <label htmlFor="sample-feed">Purpose (fill from a feed)</label>
      <NativeSelect
        id="sample-feed"
        testId="sample-feed"
        value={chosen}
        placeholder="Choose a feed"
        options={feeds.map((feed) => ({ value: feed.id, label: `${FEED_PURPOSE_LABELS[feed.purpose]}: ${feed.topic || feed.id}` }))}
        onChange={(id) => {
          setChosen(id);
          const feed = feeds.find((entry) => entry.id === id);
          if (feed) onPick(feed);
        }}
      />
    </div>
  );
}

function resultLine(data: SampleResult): string {
  if (!data.ok) return `${data.code}: ${data.detail}`;
  const how = data.feed ? `feed ${data.feed.id}` : profileKindLabel(data.kind ?? '');
  return `Decoded ${how}: ${bindingStatusLabel(data.bindingStatus)}`;
}

function SampleResultView({ data, timezone }: { data: SampleResult; timezone: string }) {
  return <div className="space-y-1 text-sm" aria-live="polite" data-testid="sample-result">
    <p>{resultLine(data)}</p>
    {data.feed && <p data-testid="sample-feed-result">Feed: {data.feed.id} ({labelOf(FEED_PURPOSE_LABELS, data.feed.purpose)})</p>}
    {data.sourceKey && <p className="break-all">Source key: {data.sourceKey}</p>}
    {data.binding && <p>Signal: {data.binding.name} ({labelOf(SIGNAL_TYPE_LABELS, data.binding.semanticType)}, {data.binding.canonicalUom ?? 'no quantity unit'})</p>}
    {data.ok && <PreviewFigures response={data} timezone={timezone} />}
    {data.ok && <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">{JSON.stringify({ observedAt: data.observedAt, quality: data.quality, values: data.values }, null, 2)}</pre>}
  </div>;
}

export function MqttSamplePreview({ connectionId, timezone, feeds }: MqttSamplePreviewProps) {
  const [topic, setTopic] = useState('');
  const [payload, setPayload] = useState('');
  // defaults to now (a sample is checked as if it arrived now); the user may pick another time
  const [receivedAt, setReceivedAt] = useState<string | null>(() => new Date().toISOString());
  const [retained, setRetained] = useState(false);
  const preview = useV2Command<Packet, SampleResult>({
    run: async ({ input }) => (await v2Request<SampleResult>({ method: 'POST', path: `/connections/${connectionId}/mqtt-preview`, body: input })).data,
    changes: () => null,
  });
  const pick = (feed: FeedForm) => {
    setTopic(sampleTopicOf(feed.topic));
    setPayload(examplePayloadText(feed.purpose, feed.fields));
  };
  return <section className="space-y-3 rounded border p-3" aria-label="Validate MQTT sample">
    <div className="flex items-center gap-1.5">
      <h3 className="font-medium">Validate MQTT sample</h3>
      <KpiInfo label="Validate MQTT sample" text={SAMPLE_INFO} />
    </div>
    {feeds && feeds.length > 0 && <FeedQuickFill feeds={feeds} onPick={pick} />}
    <label className="block space-y-1 text-sm">Topic<Input maxLength={1000} value={topic} onChange={(e) => setTopic(e.target.value)} /></label>
    <label className="block space-y-1 text-sm">Payload JSON<Textarea maxLength={65536} rows={8} value={payload} onChange={(e) => setPayload(e.target.value)} /></label>
    <DateTimeInput label="Sample receive time" timeZone={timezone} value={receivedAt} onChange={setReceivedAt} />
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={retained} onChange={(e) => setRetained(e.target.checked)} />Retained message</label>
    <Button variant="outline" disabled={!topic.trim() || !payload.trim() || !receivedAt || preview.isPending} onClick={() => { if (receivedAt) void preview.submit({ topic, payload, receivedAt, retained }).catch(() => null); }}>Validate sample (no writes)</Button>
    <ConsoleRefusal error={preview.error} />
    {preview.data && <SampleResultView data={preview.data} timezone={timezone} />}
  </section>;
}
