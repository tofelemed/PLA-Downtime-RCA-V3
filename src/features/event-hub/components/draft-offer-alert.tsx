import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { EventFormState } from '../hooks/use-event-form';
import { useEventHubEnv } from '../use-event-hub-env';

/** E-9: a recent unsaved new event of another unit than the page was opened for — resume it or start new. */
export function DraftOfferAlert({ form }: { form: Pick<EventFormState, 'offered' | 'resumeOffered' | 'dropOffered'> }) {
  const env = useEventHubEnv();
  if (!form.offered) return null;
  return (
    <Alert data-testid="draft-offer">
      <AlertDescription className="space-y-2">
        <p>You have an unsaved new event for {env.unitName(form.offered.values.unitId)}. Resume that draft or start a new event?</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={form.resumeOffered} data-testid="draft-resume">
            Resume draft
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={form.dropOffered} data-testid="draft-start-new">
            Start new
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
