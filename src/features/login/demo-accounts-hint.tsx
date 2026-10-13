import React from 'react';

/** Seeded demo logins. Rendered only in development builds so production never shows credentials. */
export const DemoAccountsHint: React.FC = () => {
  if (!import.meta.env.DEV) return null;
  return (
    <div className="mt-6 rounded-lg bg-gray-50 p-4">
      <p className="mb-2 text-sm font-medium text-gray-700">Demo Accounts:</p>
      <div className="space-y-1 text-xs text-gray-600">
        <div><span className="font-medium">admin@acme.com</span> / demo123 (SuperAdmin)</div>
        <div><span className="font-medium">test@example.com</span> / Test123!@# (SuperAdmin)</div>
        <div>manager@acme.com / demo123 (TenantAdmin)</div>
        <div>engineer@acme.com / demo123 (Engineer)</div>
        <div>operator@acme.com / demo123 (Operator)</div>
      </div>
    </div>
  );
};
