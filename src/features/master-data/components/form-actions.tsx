import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export interface FormActionsProps {
  isNew: boolean;
  saving: boolean;
  cancelTo: string;
}

/** Create / Save changes and Cancel (back to the list) at the end of a master-data form. */
export function FormActions({ isNew, saving, cancelTo }: FormActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" disabled={saving}>
        {isNew ? 'Create' : 'Save changes'}
      </Button>
      <Button type="button" variant="outline" asChild>
        <Link to={cancelTo}>Cancel</Link>
      </Button>
    </div>
  );
}
