import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Replaces the old browser-side "Status Automation" editor (rules compiled in the browser and kept in its
 * storage). Rules are now declarative data validated, versioned and evaluated by the server.
 */
export function StatusRulesMoved() {
  return (
    <Card data-testid="status-rules-moved">
      <CardHeader>
        <CardTitle>Status automation moved to rules</CardTitle>
        <CardDescription>
          Status rules are no longer written as code or kept in this browser. Build them as rules — choose fields and conditions, try them on
          past events, keep every version — in Codes &amp; rules; the server applies them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link className="underline" to="/codes-admin?tab=rules">
          Open the rules
        </Link>
      </CardContent>
    </Card>
  );
}
