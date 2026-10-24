import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { RcaCard } from '@/features/rca/components/rca-card';
import { DisabledReason } from '@/features/ux-kit/disabled-reason';
import { EditorSheet } from '@/features/ux-kit/editor-sheet';
import { ActionIcon } from '@/lib/icons';
import { DerivedStopPreview } from './derived-stop-preview';

const PREVIEW_INFO = 'Tries the settings in force on stored state samples of the unit; nothing is written.';
const PANEL_INFO =
  'Stored state samples over at most 7 days, with the settings effective at the window end. No events are written; unknown state time is never counted as a stop.';
const NO_UNIT = 'Choose a unit above to preview its state engine.';

/** The state-engine preview as an on-demand tool: "Preview derived stops" opens it in a side panel (it writes nothing). */
export function DerivedStopPreviewSection({ unitId, timezone }: { unitId: string; timezone: string }) {
  const [open, setOpen] = useState(false);
  const action = (
    <Button type="button" size="sm" variant="outline" disabled={!unitId} aria-describedby={unitId ? undefined : 'preview-no-unit'} onClick={() => setOpen(true)}>
      <ActionIcon.view className="h-4 w-4" aria-hidden="true" />
      Preview derived stops
    </Button>
  );
  return (
    <RcaCard title="State engine preview" info={PREVIEW_INFO} actions={action} testId="state-engine-preview">
      <DisabledReason id="preview-no-unit" reason={unitId ? null : NO_UNIT} />
      <EditorSheet open={open} onOpenChange={setOpen} title="State engine preview" titleAside={<KpiInfo label="the state engine preview" text={PANEL_INFO} />}>
        <DerivedStopPreview unitId={unitId} timezone={timezone} />
      </EditorSheet>
    </RcaCard>
  );
}
