import type { MonthCloseView, PersonRef } from '@/api/v2/types/month-close';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CLOSE_STATE_LABELS } from '@/features/month-close/model/close-labels';
import { resolvedActorText } from '@/features/ux-kit/labels';
import { NumberText } from '@/features/ux-kit/number-text';
import { PlantTime } from '@/features/ux-kit/plant-time';

function SignOff({ label, who, at, timezone }: { label: string; who: PersonRef | null; at: string | null; timezone: string }) {
  return (
    <li>
      <span className="font-medium">{label}:</span>{' '}
      {who ? (
        <>
          {resolvedActorText(who.id, who.name)} · <PlantTime iso={at} tz={timezone} withDate />
        </>
      ) : (
        <span className="text-muted-foreground">not yet</span>
      )}
    </li>
  );
}

function Count({ label, value, of }: { label: string; value: number; of?: number }) {
  return (
    <li>
      <span className="font-medium">{label}:</span> <NumberText value={value} />
      {of !== undefined && (
        <>
          {' of '}
          <NumberText value={of} />
        </>
      )}
    </li>
  );
}

/** Certification of the month (R3): close state, sign-offs and what still stands between it and the lock. */
export function MonthStatusCard({ view }: { view: MonthCloseView }) {
  const { prerequisites: p, signOffs: s } = view;
  const tz = view.deadlines.timezone;
  return (
    <Card data-testid="statement-status" data-state={view.state}>
      <CardHeader className="flex flex-row flex-wrap items-center gap-2 space-y-0 pb-2">
        <CardTitle className="text-base">Certification</CardTitle>
        <Badge variant={view.state === 'locked' ? 'default' : 'secondary'}>{CLOSE_STATE_LABELS[view.state]}</Badge>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm md:grid-cols-2">
        <ul className="space-y-1">
          <Count label="Periods approved" value={p.approved} of={p.periods} />
          <Count label="Production days certified" value={p.certifiedDays} of={p.days} />
          <Count label="Scheduled shifts without a period" value={p.missingPeriodCount} />
          <Count label="Open change proposals" value={p.openProposalCount} />
          {p.uncoveredDayCount !== undefined && <Count label="Days without an approved plan" value={p.uncoveredDayCount} />}
        </ul>
        <ul className="space-y-1">
          <SignOff label="Quantities closed" who={s.quantitiesClosedBy} at={s.quantitiesClosedAt} timezone={tz} />
          {s.materialityRequired && <SignOff label="Materiality reviewed" who={s.materialityReviewedBy} at={s.materialityReviewedAt} timezone={tz} />}
          <SignOff label="Finance signed off" who={s.financeSignedOffBy} at={s.financeSignedOffAt} timezone={tz} />
          <SignOff label="Locked" who={s.lockedBy} at={s.lockedAt} timezone={tz} />
        </ul>
      </CardContent>
    </Card>
  );
}
