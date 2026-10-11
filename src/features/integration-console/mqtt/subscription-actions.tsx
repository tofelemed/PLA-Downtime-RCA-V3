import { useState } from 'react';
import type { IngestionJobView, JobAction } from '@/api/v2/types/integrations';
import { Button } from '@/components/ui/button';
import { JobCommandDialog } from '../jobs/job-command-dialog';
import { JobTransitions } from '../jobs/job-transitions';
import { allowedActions } from '../model/job-states';
import { MQTT_ACTION_TEXT } from './model/mqtt-job-text';

/**
 * pause / resume / drain / stop / start of the subscribe job through the job command endpoint
 * (audited with a reason; the server judges the transition), plus its audit trail.
 */
export function SubscriptionActions({ job, timezone }: { job: IngestionJobView | null; timezone: string }) {
  const [action, setAction] = useState<JobAction | null>(null);
  const [trail, setTrail] = useState(false);
  if (!job) return null;
  return (
    <div className="space-y-2" data-testid="mqtt-actions">
      <div className="flex flex-wrap gap-2">
        {allowedActions(job.state).map((next) => (
          <Button key={next} size="sm" variant={MQTT_ACTION_TEXT[next].destructive ? 'destructive' : 'outline'} onClick={() => setAction(next)} data-testid={`job-${next}`}>
            {MQTT_ACTION_TEXT[next].label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" aria-expanded={trail} onClick={() => setTrail(!trail)} data-testid="job-trail-toggle">
          Audit trail
        </Button>
      </div>
      {job.lastError && <p className="text-xs text-destructive">{job.lastError}</p>}
      {trail && <JobTransitions jobId={job.id} timezone={timezone} />}
      <JobCommandDialog job={job} action={action} texts={MQTT_ACTION_TEXT} onClose={() => setAction(null)} />
    </div>
  );
}
