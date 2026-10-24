import { useState } from 'react';
import { useJobCommand } from '@/api/v2/queries/ingestion-jobs';
import type { IngestionJobView, JobAction } from '@/api/v2/types/integrations';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ConsoleRefusal } from '../components/console-refusal';
import { Field } from '../components/field';
import { ACTION_TEXT } from '../model/job-states';

export interface JobCommandDialogProps {
  job: IngestionJobView;
  /** null = closed */
  action: JobAction | null;
  /** what each command does for this job kind (default: the PI pull-job wording) */
  texts?: typeof ACTION_TEXT;
  onClose: () => void;
}

/** Confirmation of a job command with the reason kept in the audit trail (ING02). */
export function JobCommandDialog({ job, action, texts = ACTION_TEXT, onClose }: JobCommandDialogProps) {
  const [reason, setReason] = useState('');
  const command = useJobCommand();
  const close = () => {
    setReason('');
    command.reset();
    onClose();
  };
  const confirm = async () => {
    if (!action) return;
    const done = await command.submit({ jobId: job.id, action, reason: reason.trim() || `${action} from the integration console` }).catch(() => null);
    if (done) close();
  };
  const text = action ? texts[action] : null;
  return (
    <Dialog open={action !== null} onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-[560px]" data-testid="job-command-dialog">
        <DialogHeader>
          <DialogTitle>{text?.label} job</DialogTitle>
          <DialogDescription>{text?.confirm}</DialogDescription>
        </DialogHeader>
        <Field id="job-reason" label="Reason (audited)">
          <Textarea id="job-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} />
        </Field>
        <ConsoleRefusal error={command.error} />
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button variant={text?.destructive ? 'destructive' : 'default'} disabled={command.isPending} onClick={() => void confirm()} data-testid="job-command-confirm">
            {text?.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
