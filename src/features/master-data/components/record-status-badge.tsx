import { Badge } from '@/components/ui/badge';

/** "Active" / "Retired" as a badge with a word (never colour alone). */
export function RecordStatusBadge({ retired }: { retired: boolean }) {
  return retired ? (
    <Badge variant="outline" className="text-muted-foreground">
      Retired
    </Badge>
  ) : (
    <Badge variant="secondary">Active</Badge>
  );
}
