import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Replaces the old browser-side "Status Automation" editor (B15: rules compiled in the browser and kept in its storage).
 * Rules are now declarative data validated, versioned and evaluated by the server (plan 3.8).
 */
export function StatusRulesMoved() {
  return (
    <Card data-testid="status-rules-moved">
      <CardHeader>
        <CardTitle>Status automation moved to server rules</CardTitle>
        <CardDescription>
          Rules are no longer written as JavaScript or kept in this browser. Build them as declarative rules (allowlisted fields and
          operators, simulation, versions, rollback) in Codes &amp; rules; the server applies them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link className="underline" to="/codes-admin">
          Open Codes &amp; rules
        </Link>{' '}
        (needs the “v2.codesAdmin” feature for this plant).
      </CardContent>
    </Card>
  );
}
