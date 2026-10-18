import type { FriendlyError } from './describe-error';

/**
 * "Line 1 · Quantity: Must be positive" items of a refusal, and "Unexpected field: xyz" for a property
 * the server does not accept; nothing when there are none. `data-field` carries the server path for tests.
 */
export function FieldMessageList({ fieldMessages }: Pick<FriendlyError, 'fieldMessages'>) {
  if (fieldMessages.length === 0) return null;
  return (
    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm" data-testid="field-messages">
      {fieldMessages.map((entry, index) => (
        <li key={`${entry.label}-${index}`} data-field={entry.field} data-unexpected={entry.unexpected ? 'true' : undefined}>
          <span className="font-medium">{entry.label}</span>: {entry.message}
        </li>
      ))}
    </ul>
  );
}
