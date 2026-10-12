import { Link } from 'react-router-dom';

export interface RecordLinkProps {
  to: string;
  children: string;
  /** warms the detail cache (hover / keyboard focus) */
  onPrefetch?: () => void;
}

/** The name cell of a master-data list: a link to the record's page that prefetches it on hover. */
export function RecordLink({ to, children, onPrefetch }: RecordLinkProps) {
  return (
    <Link
      to={to}
      className="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
    >
      {children}
    </Link>
  );
}
