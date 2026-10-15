import type { MonthCloseView, PersonRef } from '@/api/v2/types/month-close';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { Section } from '@/features/ux-kit/page-layout';
import { CloseActions } from './close-actions';

function SignOff({ label, who, at, timezone, testId }: { label: string; who: PersonRef | null; at: string | null; timezone: string; testId: string }) {
  return (
    <li data-testid={testId} data-signed={Boolean(who)}>
      <span className="font-medium">{label}:</span>{' '}
      {who ? (
        <>
          {who.name ?? 'a user'} · <PlantTime iso={at} tz={timezone} withDate />
        </>
      ) : (
        <span className="text-muted-foreground">not yet</span>
      )}
    </li>
  );
}

/** The two sign-offs (plant management, finance), the optional materiality review, the lock and the steps. */
export function CloseSignOffs({ view }: { view: MonthCloseView }) {
  const { signOffs, deadlines } = view;
  const tz = deadlines.timezone;
  return (
    <Section title="Sign-offs" description="Plant management closes the quantities; finance signs off independently and locks the month.">
      <div className="space-y-3">
        <ul className="space-y-1 text-sm">
          <SignOff label="Quantities closed (plant management)" who={signOffs.quantitiesClosedBy} at={signOffs.quantitiesClosedAt} timezone={tz} testId="signoff-quantities" />
          {(signOffs.materialityRequired || view.policy.materialityEnabled) && (
            <SignOff
              label={signOffs.materialityRequired ? 'Materiality review (required)' : 'Materiality review (not required this month)'}
              who={signOffs.materialityReviewedBy}
              at={signOffs.materialityReviewedAt}
              timezone={tz}
              testId="signoff-materiality"
            />
          )}
          <SignOff label="Finance sign-off" who={signOffs.financeSignedOffBy} at={signOffs.financeSignedOffAt} timezone={tz} testId="signoff-finance" />
          <SignOff label="Locked" who={signOffs.lockedBy} at={signOffs.lockedAt} timezone={tz} testId="signoff-locked" />
        </ul>
        {view.state === 'locked' && (
          <p className="text-sm text-muted-foreground" data-testid="locked-note">
            Approved periods of this month change only through a change proposal; the correction is marked “after close”. Production
            accounting or plant management propose one from the period page (“Propose a correction”); another approver decides it.
          </p>
        )}
        {(view.state === 'quantities_closed' || view.state === 'finance_signed_off') && (
          <p className="text-sm text-muted-foreground" data-testid="closing-note">
            A correction can be proposed from the period page now; it is accepted after the month is reopened or locked.
          </p>
        )}
        <CloseActions view={view} />
      </div>
    </Section>
  );
}
