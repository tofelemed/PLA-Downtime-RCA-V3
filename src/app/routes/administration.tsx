import { lazyNamedWithPreload, lazyWithPreload } from '@/lib/lazy-with-preload';
import { FlaggedRoute } from '@/features/v2-foundation/flagged-route';
import type { AppRoute } from './route-types';

const MasterData = lazyWithPreload(() => import('@/pages/MasterData'));
/** Codes and declarative admin rules (plan 3.8), served at `/codes-admin` while `v2.codesAdmin` is on. */
const CodesAdmin = lazyNamedWithPreload(() => import('@/features/codes-admin/codes-admin-page'), 'CodesAdminPage');
const CodesAdminOff = lazyNamedWithPreload(() => import('@/features/codes-admin/codes-admin-off'), 'CodesAdminOff');
/** Valuation policy and FX rates (plan 2.6 screens), served at `/finance` while `v2.codesAdmin` is on. */
const Finance = lazyNamedWithPreload(() => import('@/features/finance/finance-page'), 'FinancePage');
const FinanceOff = lazyNamedWithPreload(() => import('@/features/finance/finance-off'), 'FinanceOff');
const UserManagement = lazyNamedWithPreload(() => import('@/pages/UserManagement'), 'UserManagement');
const AdminPanel = lazyNamedWithPreload(() => import('@/pages/AdminPanel'), 'AdminPanel');
const PermissionsManagement = lazyNamedWithPreload(() => import('@/pages/PermissionsManagement'), 'PermissionsManagement');
const AuditLogs = lazyWithPreload(() => import('@/pages/AuditLogs'));
/** Plant settings (calendar system, digits; timezone read-only). */
const PlantSettings = lazyNamedWithPreload(() => import('@/features/settings/settings-page'), 'SettingsPage');

/** Administration area: master data, codes, finance, users, permissions, audit, settings (T5, T7, T8). */
export const ADMINISTRATION_ROUTES: readonly AppRoute[] = [
  { path: '/master-data', element: <MasterData />, preload: MasterData.preload },
  {
    path: '/codes-admin',
    element: <FlaggedRoute flag="v2.codesAdmin" v1={<CodesAdminOff />} v2={<CodesAdmin />} preloadV2={CodesAdmin.preload} />,
    preload: CodesAdmin.preload,
  },
  {
    path: '/finance',
    element: <FlaggedRoute flag="v2.codesAdmin" v1={<FinanceOff />} v2={<Finance />} preloadV2={Finance.preload} />,
    preload: Finance.preload,
  },
  { path: '/users', element: <UserManagement />, preload: UserManagement.preload },
  { path: '/admin', element: <AdminPanel />, preload: AdminPanel.preload },
  { path: '/permissions', element: <PermissionsManagement />, preload: PermissionsManagement.preload },
  { path: '/audit', element: <AuditLogs />, preload: AuditLogs.preload },
  { path: '/settings', element: <PlantSettings />, preload: PlantSettings.preload },
];
