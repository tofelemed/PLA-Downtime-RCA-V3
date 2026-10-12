import { Alert, AlertDescription } from '@/components/ui/alert';
import { StatusIcon } from '@/lib/icons';

const NOTES: Readonly<Record<string, { id: string; text: string }>> = {
  profiles: {
    id: 'valuation',
    text: 'Rates are entered in IRR or USD. Losses are valued only after finance approves a valuation policy. Plans need approved rates: there is no default rate.',
  },
  calendars: {
    id: 'calendar',
    text: 'Create and publish the plant calendar here. A holiday with “Reduced hours” is flagged in the preview but does not shorten the shifts yet.',
  },
};

/** One short note per tab about what is not decided or not automatic yet (plain language, no codes). */
export function DecisionBanners({ tab }: { tab: string }) {
  const note = NOTES[tab];
  if (!note) return null;
  const Icon = StatusIcon.info;
  return (
    <Alert data-testid="decision-banner" data-decision={note.id}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      <AlertDescription>{note.text}</AlertDescription>
    </Alert>
  );
}
