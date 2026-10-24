import { Link } from 'react-router-dom';
import type { BrandingView as BrandingSettings } from '@/api/v2/types/administration';
import { usePlantSelection } from '@/contexts/PlantSelectionContext';
import { APP_TITLE } from '@/features/ux-kit/page-layout/use-document-title';
import { cn } from '@/lib/utils';
import { BrandMark } from './brand-mark';

export interface SidebarBrandProps {
  branding: BrandingSettings | undefined;
  collapsed: boolean;
}

/** The top of the sidebar: the brand mark, app name and plant name; one link back to the Dashboard. */
export function SidebarBrand({ branding, collapsed }: SidebarBrandProps) {
  const appName = branding?.appName || APP_TITLE;
  const plantName = usePlantSelection().selection?.tenant?.name;
  return (
    <Link
      to="/dashboard"
      aria-label={`${appName} — go to Dashboard`}
      title={collapsed ? appName : undefined}
      className={cn(
        'flex items-center gap-3 border-b border-sidebar-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        collapsed ? 'justify-center py-3' : 'px-4 py-3',
      )}
    >
      <BrandMark branding={branding} />
      {!collapsed && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-xs font-semibold uppercase tracking-wide text-sidebar-foreground">{appName}</span>
          {plantName && <span className="block truncate text-[11px] uppercase tracking-wide text-muted-foreground">{plantName}</span>}
        </span>
      )}
    </Link>
  );
}
