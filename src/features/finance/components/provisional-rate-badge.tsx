import { Badge } from '@/components/ui/badge';

/** SME V7: marks an authorised provisional exchange rate (in words, never colour alone). */
export function ProvisionalRateBadge({ provisional }: { provisional: boolean }) {
  if (!provisional) return null;
  return (
    <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400" data-testid="fx-provisional-badge">
      Provisional
    </Badge>
  );
}
