import { Link } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * What `/codes-admin` shows while `v2.codesAdmin` is off (decision C4): the v1 code screens in Master
 * Data stay in use; declarative rules need the v2 screen.
 */
export function CodesAdminOff() {
  return (
    <Alert data-testid="codes-admin-off">
      <AlertTitle>Codes &amp; rules is not enabled for this plant</AlertTitle>
      <AlertDescription>
        Manage codes in <Link className="underline" to="/master-data">Master Data</Link>. A manager can switch this screen on with the
        “v2.codesAdmin” feature flag.
      </AlertDescription>
    </Alert>
  );
}
