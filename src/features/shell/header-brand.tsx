import { Link } from 'react-router-dom';
import type { BrandingView } from '@/api/v2/types/administration';
import { APP_TITLE } from '@/features/ux-kit/page-layout/use-document-title';
import { BrandMark } from './brand-mark';

/** The brand at the far left of the header: mark and app name (name hidden below `sm`), one link to the Dashboard. */
export function HeaderBrand({ branding }: { branding: BrandingView | undefined }) {
  const appName = branding?.appName || APP_TITLE;
  return (
    <Link
      to="/dashboard"
      aria-label={`${appName} — go to Dashboard`}
      className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <BrandMark branding={branding} />
      <span className="hidden max-w-[10rem] truncate text-sm font-semibold text-foreground sm:block">{appName}</span>
    </Link>
  );
}
