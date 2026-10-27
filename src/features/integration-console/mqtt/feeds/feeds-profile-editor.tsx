import type { ConnectionView } from '@/api/v2/types/integrations';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ConsoleRefusal } from '../../components/console-refusal';
import { useFeedsDraft } from '../hooks/use-feeds-draft';
import { ProfileSaveBar } from '../profile-save-bar';
import { FeedsEditor } from './feeds-editor';

/** Payload profile tab of a feeds connection: the feeds, saved as `payloadProfilePatch: { feeds }`. */
export function FeedsProfileEditor({ connection }: { connection: ConnectionView }) {
  const { canWriteIntegration } = useCapabilities();
  const draft = useFeedsDraft(connection);
  return (
    <section aria-label="Payload profile" className="min-w-0 space-y-4" data-testid="profile-editor" data-kind="feeds" data-dirty={draft.patch !== null}>
      <h2 className="sr-only">PLA and downtime feeds</h2>
      <ProfileSaveBar editor={draft} canWrite={canWriteIntegration} />
      <ConsoleRefusal error={draft.failed} />
      {!canWriteIntegration && <p className="text-sm text-muted-foreground">Read only: changing the feeds needs the integration administrator role.</p>}
      <FeedsEditor feeds={draft.feeds} errors={draft.feedErrors} onChange={draft.change} readOnly={!canWriteIntegration} />
    </section>
  );
}
