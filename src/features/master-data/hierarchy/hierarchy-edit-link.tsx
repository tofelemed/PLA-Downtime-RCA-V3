import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';

export interface HierarchyEditLinkProps {
  kind: 'organization' | 'plant';
  id: string;
  name: string;
  /** the server's `canEdit` flag of the directory entry */
  canEdit?: boolean;
}

/** "Edit" on an organization / plant node: opens its Setup › Organizations & plants edit page, back to this tree after saving. */
export function HierarchyEditLink({ kind, id, name, canEdit }: HierarchyEditLinkProps) {
  const { canManagePlants } = useCapabilities();
  if (!canEdit || !canManagePlants) return null;
  const base = kind === 'plant' ? '/setup/plants' : '/setup/plants/organizations';
  return (
    <Button size="sm" variant="ghost" asChild>
      <Link to={`${base}/${encodeURIComponent(id)}/edit?from=hierarchy`} aria-label={`Edit ${kind} ${name}`}>
        Edit
      </Link>
    </Button>
  );
}
