import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DisabledReason } from '@/features/ux-kit/disabled-reason';

export interface FormActionsProps {
  isNew: boolean;
  saving: boolean;
  cancelTo: string;
  /** an existing record has unsaved edits; without them "Save changes" is disabled (QA L4). Default true. */
  dirty?: boolean;
}

const REASON_ID = 'form-actions-reason';

/** Create / Save changes and Cancel (back to the list) at the end of a master-data form. */
export function FormActions({ isNew, saving, cancelTo, dirty = true }: FormActionsProps) {
  const unchanged = !isNew && !dirty;
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving || unchanged} aria-describedby={unchanged ? REASON_ID : undefined}>
          {isNew ? 'Create' : 'Save changes'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link to={cancelTo}>Cancel</Link>
        </Button>
      </div>
      <DisabledReason id={REASON_ID} reason={unchanged && !saving ? 'No changes to save.' : null} />
    </div>
  );
}
