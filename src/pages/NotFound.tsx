import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/features/ux-kit/page-layout/use-document-title';

/**
 * Unknown address: says which path was not found and links back in-app (no full page reload, theme
 * colours, a tab title) instead of logging to the console.
 */
const NotFound = () => {
  const location = useLocation();
  useDocumentTitle('Page not found');
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="max-w-md space-y-3 text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="text-lg text-muted-foreground">This page does not exist.</p>
        <p className="break-all font-mono text-sm text-muted-foreground">{location.pathname}</p>
        <Button asChild>
          <Link to="/dashboard">Go to the dashboard</Link>
        </Button>
      </div>
    </main>
  );
};

export default NotFound;
