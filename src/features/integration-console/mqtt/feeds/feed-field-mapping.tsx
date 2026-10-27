import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { defaultFields, templateOf } from '../model/feed-templates';
import { fieldOverrides, type FeedForm } from '../model/feeds';

interface FeedFieldMappingProps {
  feed: FeedForm;
  errors?: Record<string, string>;
  readOnly: boolean;
  onChange: (fields: Record<string, string>) => void;
}

/** Template keys and the payload path each is read from; edited paths are the only ones stored. */
export function FeedFieldMapping({ feed, errors = {}, readOnly, onChange }: FeedFieldMappingProps) {
  const { number } = useNumberFormat();
  const edited = Object.keys(fieldOverrides(feed)).length;
  const hasErrors = Object.keys(errors).length > 0;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (hasErrors) setOpen(true);
  }, [hasErrors]);
  return (
    <details className="rounded-md border p-3" open={open} onToggle={(event) => setOpen(event.currentTarget.open)} data-testid="feed-mapping">
      <summary className="cursor-pointer text-sm font-medium">
        Field mapping <span className="font-normal text-muted-foreground">({edited === 0 ? 'template' : `${number(edited)} edited`})</span>
      </summary>
      <div className="mt-3 space-y-2">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <caption className="sr-only">Field mapping of feed {feed.id}</caption>
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="py-1 pr-2 font-medium">Field</th>
                <th scope="col" className="py-1 pr-2 font-medium">Path in the payload</th>
                <th scope="col" className="py-1 font-medium">Meaning</th>
              </tr>
            </thead>
            <tbody>
              {templateOf(feed.purpose).map((field) => {
                const id = `feed-${feed.id}-field-${field.key}`;
                const error = errors[field.key];
                return (
                  <tr key={field.key} className="border-t align-top">
                    <td className="py-2 pr-2">
                      <label htmlFor={id} className="font-medium">{field.label}</label>
                      <div className="mt-1">{field.required ? <Badge variant="secondary">Required</Badge> : <span className="text-xs text-muted-foreground">Optional</span>}</div>
                    </td>
                    <td className="py-2 pr-2">
                      <Input
                        id={id}
                        className="h-8 font-mono text-xs"
                        data-testid={`feed-field-${field.key}`}
                        value={feed.fields[field.key] ?? ''}
                        placeholder={field.path || 'not read'}
                        readOnly={readOnly}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? `${id}-error` : undefined}
                        onChange={(event) => onChange({ ...feed.fields, [field.key]: event.target.value })}
                      />
                      {error && <p id={`${id}-error`} className="mt-1 text-xs text-destructive">{error}</p>}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">{field.help}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!readOnly && (
          <Button type="button" size="sm" variant="outline" disabled={edited === 0} onClick={() => onChange(defaultFields(feed.purpose))} data-testid="feed-mapping-reset">
            Reset to template
          </Button>
        )}
      </div>
    </details>
  );
}
