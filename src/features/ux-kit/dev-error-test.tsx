import { useSearchParams } from 'react-router-dom';
import { V2ApiError } from '@/api/v2/errors';
import { Button } from '@/components/ui/button';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';

const authError = () =>
  new V2ApiError(401, { code: 'UNAUTHORIZED', message: 'Session expired (test)', correlationId: null, retryable: false });

function Thrower({ kind }: { kind: string }): null {
  if (kind === 'render') throw new Error('Test render error from /dev/error-test');
  if (kind === 'auth') throw authError();
  return null;
}

/**
 * Development-only page that triggers each failure the error handling covers (route `/dev/error-test`,
 * never in production builds): `?kind=render` throws while rendering (error page in the shell),
 * `?kind=auth` throws a 401 while rendering (signs out to the login screen), and the button rejects a
 * promise nobody handles (friendly toast).
 */
export function DevErrorTest() {
  const [params] = useSearchParams();
  const kind = params.get('kind') ?? '';
  const reject = () => {
    void Promise.reject(new Error('Test unhandled rejection from /dev/error-test'));
  };
  return (
    <Page>
      <PageHeader title="Error handling test" description="Development only. Each link or button triggers one kind of failure." />
      <Thrower kind={kind} />
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li><a className="underline" href="/dev/error-test?kind=render">Render error</a> — the error page inside the shell</li>
        <li><a className="underline" href="/dev/error-test?kind=auth">Authentication failure (401)</a> — signs out to the login screen</li>
      </ul>
      <Button type="button" className="mt-4" onClick={reject}>Unhandled promise rejection</Button>
    </Page>
  );
}
