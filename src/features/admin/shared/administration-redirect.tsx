import { Navigate, useLocation } from 'react-router-dom';

/** `/admin/plants/…` → `/setup/plants/…`, `/admin/organizations/…` → `/setup/plants/organizations/…` (22 Oct 2026). */
function plantsPathOf(pathname: string): string {
  if (pathname.startsWith('/admin/organizations')) return `/setup/plants/organizations${pathname.slice('/admin/organizations'.length)}`;
  if (pathname.startsWith('/admin/plants')) return `/setup/plants${pathname.slice('/admin/plants'.length)}`;
  return '/setup/plants';
}

/** Old bookmarks retain their record path, search, and hash under the new owning area. */
export function AdministrationRedirect({ kind }: { kind: 'settings' | 'codes' | 'setup' | 'plants' }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  if (kind === 'settings') params.set('tab', 'settings');
  if (kind === 'plants') params.delete('tab');
  if (kind === 'setup') return <Navigate replace to={{ pathname: '/equipment-setup', search: location.search, hash: location.hash }} />;
  const pathname =
    kind === 'settings' ? '/admin' : kind === 'plants' ? plantsPathOf(location.pathname) : `/master-data/codes-rules${location.pathname.slice('/codes-admin'.length)}`;
  return <Navigate replace to={{ pathname, search: params.size ? `?${params}` : '', hash: location.hash }} />;
}
