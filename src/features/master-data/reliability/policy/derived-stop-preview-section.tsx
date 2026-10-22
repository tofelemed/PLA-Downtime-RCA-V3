import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Section } from '@/features/ux-kit/page-layout';
import { ActionIcon } from '@/lib/icons';
import { DerivedStopPreview } from './derived-stop-preview';
import { EditorSheet } from '@/features/ux-kit/editor-sheet';

/** The state-engine preview as an on-demand tool: "Preview derived stops" opens it in a side panel (it writes nothing). */
export function DerivedStopPreviewSection({ unitId, timezone }: { unitId: string; timezone: string }) {
  const [open, setOpen] = useState(false);
  const action = (
    <Button type="button" size="sm" variant="outline" disabled={!unitId} onClick={() => setOpen(true)}>
      <ActionIcon.view className="h-4 w-4" aria-hidden="true" />
      Preview derived stops
    </Button>
  );
  const description = unitId
    ? 'Try the settings in force on stored state samples of the unit; nothing is written.'
    : 'Choose a unit above to preview its state engine.';
  return (
    <Section title="State engine preview" description={description} actions={action}>
      <EditorSheet open={open} onOpenChange={setOpen} title="State engine preview" description="Derived stops and slowdowns of the chosen unit; no events are written.">
        <DerivedStopPreview unitId={unitId} timezone={timezone} />
      </EditorSheet>
    </Section>
  );
}
