import { Navigate, useLocation } from 'react-router-dom';

/** Old bookmarks retain their record path, search, and hash under the new owning area. */
export function AdministrationRedirect({ kind }: { kind: 'settings' | 'codes' | 'setup' }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  if (kind === 'settings') params.set('tab', 'settings');
  if (kind === 'setup') return <Navigate replace to={{ pathname: '/equipment-setup', search: location.search, hash: location.hash }} />;
  const pathname = kind === 'settings' ? '/admin' : `/master-data/codes-rules${location.pathname.slice('/codes-admin'.length)}`;
  return <Navigate replace to={{ pathname, search: params.size ? `?${params}` : '', hash: location.hash }} />;
}
