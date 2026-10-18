/** Why a submit button is disabled, shown next to it; wire the button with `aria-describedby={reason ? id : undefined}` (H-5). */
export function DisabledReason({ id, reason }: { id: string; reason: string | null | undefined }) {
  if (!reason) return null;
  return (
    <p id={id} className="text-xs text-muted-foreground" data-testid="disabled-reason">
      {reason}
    </p>
  );
}
