import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRcaCauses } from '@/api/v2/queries/rca-cases';
import { Button } from '@/components/ui/button';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { RCA_CAUSE_KIND_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { Section } from '@/features/ux-kit/page-layout';
import { ActionIcon } from '@/lib/icons';
import { CAUSES_ANCHOR, causesLocked, groupCauses } from '../../model/cause-form';
import { useCaseWorkspace } from '../case-context';
import { CauseEditor } from './cause-editor';
import { CauseItem } from './cause-item';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';

/** `new` = the add form is open; a cause id = that cause is edited; null = none. */
type Editing = 'new' | string | null;

function useScrollToAnchor() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash === `#${CAUSES_ANCHOR}`) document.getElementById(CAUSES_ANCHOR)?.scrollIntoView?.({ block: 'start' });
  }, [hash]);
}

const CAUSES_INFO = 'Root, direct and contributing causes, each with a code from the cause library when one fits.';
const LOCKED_INFO = 'Causes are locked once closure is requested; they can be changed again if the closure is sent back.';

/** The Causes ⓘ; once closure is requested it also says why the causes cannot be changed. */
function CausesInfo({ locked }: { locked: boolean }) {
  if (!locked) return <KpiInfo label="Causes" text={CAUSES_INFO} />;
  return (
    <span className="inline-flex" data-testid="causes-locked">
      <KpiInfo label="Causes" text={`${CAUSES_INFO} ${LOCKED_INFO}`} />
    </span>
  );
}

/**
 * Item 7: the direct, contributing and root causes of the case, coded from the cause library. Read-only
 * once closure is requested or for users who cannot write RCA; the free-text root cause stays the narrative.
 */
export function CausesPanel() {
  const { rca, readOnly } = useCaseWorkspace();
  const causes = useRcaCauses(rca.id);
  const [editing, setEditing] = useState<Editing>(null);
  const locked = causesLocked(rca.status);
  const canWrite = !readOnly && !locked;
  const items = causes.data ?? [];
  useScrollToAnchor();
  const add = canWrite && editing !== 'new' ? (
    <Button size="sm" onClick={() => setEditing('new')} data-testid="add-cause">
      <ActionIcon.add aria-hidden="true" className="mr-1 h-4 w-4" />
      Add cause
    </Button>
  ) : null;
  return (
    <Section id={CAUSES_ANCHOR} title="Causes" titleAside={<CausesInfo locked={locked} />} actions={add}>
      <div className="space-y-3" data-testid="causes-panel">
        {canWrite && editing === 'new' && <CauseEditor onDone={() => setEditing(null)} />}
        <DataState state={dataStateOf(causes, { isEmpty: items.length === 0 })} error={causes.error} onRetry={() => causes.refetch()} detail="No causes recorded yet.">
          {groupCauses(items).filter((group) => group.causes.length > 0).map((group) => (
            <section key={group.kind} aria-label={RCA_CAUSE_KIND_LABELS[group.kind]} data-testid={`causes-${group.kind}`}>
              <h3 className="mb-1 text-sm font-medium">{RCA_CAUSE_KIND_LABELS[group.kind]}s</h3>
              <ul className="divide-y rounded border">
                {group.causes.map((cause) =>
                  canWrite && editing === cause.id ? (
                    <li key={cause.id} className="p-2"><CauseEditor key={cause.rowVersion} cause={cause} onDone={() => setEditing(null)} /></li>
                  ) : (
                    <CauseItem key={cause.id} cause={cause} canWrite={canWrite} onEdit={() => setEditing(cause.id)} />
                  ),
                )}
              </ul>
            </section>
          ))}
        </DataState>
      </div>
    </Section>
  );
}
