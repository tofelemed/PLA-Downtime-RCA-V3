import { useLocation, Navigate } from 'react-router-dom';
/** Preserve bookmarks and selected-user/search state after consolidating the former pages. */
export function UserManagementRedirect({ tab }: { tab: 'permissions' | 'delegations' }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set('tab', tab);
  return <Navigate replace to={{ pathname: '/users', search: `?${params}`, hash: location.hash }} />;
}
