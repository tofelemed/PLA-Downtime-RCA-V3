import type { FriendlyError } from './describe-error';

/** "Line 1 · Quantity: Must be positive" items of a refusal; nothing when there are none. */
export function FieldMessageList({ fieldMessages }: Pick<FriendlyError, 'fieldMessages'>) {
  if (fieldMessages.length === 0) return null;
  return (
    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
      {fieldMessages.map((entry, index) => (
        <li key={`${entry.label}-${index}`}>
          <span className="font-medium">{entry.label}</span>: {entry.message}
        </li>
      ))}
    </ul>
  );
}
