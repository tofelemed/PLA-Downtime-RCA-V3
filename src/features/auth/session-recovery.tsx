import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export function SessionRecovery() {
  const { startupError, restoreSession, logout } = useAuth();
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="max-w-md space-y-4" aria-labelledby="session-recovery-title">
        <h1 id="session-recovery-title" className="text-xl font-semibold">Unable to load your session</h1>
        <p role="alert">{startupError}</p>
        <div className="flex gap-3">
          <Button onClick={() => void restoreSession()}>Retry session</Button>
          <Button variant="outline" onClick={() => void logout()}>Sign out</Button>
        </div>
      </section>
    </main>
  );
}
