import { StatusIcon } from '@/lib/icons';

/** Completeness hints of a method (icon and words; nothing here blocks saving). */
export function ToolChecklist({ items }: { items: ReadonlyArray<{ label: string; done: boolean }> }) {
  return (
    <ul className="space-y-1 text-sm" aria-label="Checklist" data-testid="tool-checklist">
      {items.map((item) => {
        const Icon = item.done ? StatusIcon.success : StatusIcon.warning;
        return (
          <li key={item.label} className="flex items-center gap-2">
            <Icon aria-hidden="true" className="h-4 w-4" />
            <span>
              {item.label}
              <span className="sr-only">{item.done ? ' (done)' : ' (open)'}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
