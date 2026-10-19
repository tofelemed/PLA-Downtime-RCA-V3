import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { PersonName } from '@/features/ux-kit/labels/person-name';

export interface PolicyPersonProps {
  /** user id of the author or approver; null = written by the system (a seeded default) */
  id: string | null | undefined;
}

/**
 * Who wrote or approved a finance version (QA M2, rule of 2026-10-18): the person's name, "(you)" after
 * the viewer's own name, "System" for a seeded default; never "Another user".
 */
export function PolicyPerson({ id }: PolicyPersonProps) {
  const userId = useCurrentUserId();
  if (!id) return <span data-testid="policy-person">System</span>;
  return (
    <span data-testid="policy-person">
      <PersonName id={id} />
      {userId !== null && userId === id ? ' (you)' : ''}
    </span>
  );
}
