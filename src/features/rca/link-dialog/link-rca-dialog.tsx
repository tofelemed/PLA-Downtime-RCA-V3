import { useState } from 'react';
import { useEventRcaEvidence } from '@/api/v2/queries/rca-cases';
import { useLinkEventToRca } from '@/api/v2/queries/rca-commands';
import type { RcaLinkResultView, RcaPriority } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { CommandError } from '@/features/event-hub/components/command-error';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { EvidenceView } from '../components/evidence-view';
import { PrioritySelect } from '../cases/status-fields';
import { CaseSearch, type SearchContext } from './case-search';

export interface LinkRcaDialogProps {
  eventId: string;
  context: SearchContext;
  timezone: string;
  onClose: () => void;
  onDone: (result: RcaLinkResultView) => void;
}

/**
 * §16.2 "Create / link RCA" of an event: search existing cases (asset, reason, window, title) or open a
 * new one, with the evidence package the link will snapshot. Linking twice is harmless (idempotent).
 */
export function LinkRcaDialog({ eventId, context, timezone, onClose, onDone }: LinkRcaDialogProps) {
  const evidence = useEventRcaEvidence(eventId);
  const link = useLinkEventToRca();
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selected, setSelected] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<RcaPriority>('Medium');
  const [reason, setReason] = useState('');
  const ready = mode === 'existing' ? selected !== null : title.trim() !== '';
  const submit = async () => {
    const body =
      mode === 'existing'
        ? { rcaId: selected as string, reason: reason.trim() || undefined }
        : { create: { title: title.trim(), priority }, reason: reason.trim() || undefined };
    const result = await link.submit({ eventId, body }).catch(() => null);
    if (result) onDone(result);
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" data-testid="link-rca-dialog">
        <DialogHeader>
          <DialogTitle>Create / link RCA</DialogTitle>
          <DialogDescription>The link stores the evidence package below; it never codes the event or changes its loss.</DialogDescription>
        </DialogHeader>
        <Tabs value={mode} onValueChange={(value) => setMode(value === 'new' ? 'new' : 'existing')}>
          <TabsList>
            <TabsTrigger value="existing">Existing case</TabsTrigger>
            <TabsTrigger value="new">New case</TabsTrigger>
          </TabsList>
          <TabsContent value="existing">
            <CaseSearch context={context} selectedId={selected} onSelect={setSelected} />
          </TabsContent>
          <TabsContent value="new" className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="new-case-title">Title</Label>
              <Input id="new-case-title" value={title} maxLength={255} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <PrioritySelect id="new-case-priority" value={priority} onChange={setPriority} />
          </TabsContent>
        </Tabs>
        <div className="space-y-1">
          <Label htmlFor="link-reason">Why this link (optional)</Label>
          <Textarea id="link-reason" value={reason} maxLength={2000} onChange={(e) => setReason(e.target.value)} />
        </div>
        <section aria-label="Evidence preview" className="rounded border p-2">
          <h3 className="mb-1 text-sm font-medium">Evidence package (preview)</h3>
          <DataState state={dataStateOf(evidence)} error={evidence.error}>
            {evidence.data && <EvidenceView evidence={{ ...evidence.data }} timezone={timezone} />}
          </DataState>
        </section>
        <CommandError error={link.error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!ready || link.isPending} onClick={() => void submit()} data-testid="link-rca-submit">
            {mode === 'existing' ? 'Link to case' : 'Create case and link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
