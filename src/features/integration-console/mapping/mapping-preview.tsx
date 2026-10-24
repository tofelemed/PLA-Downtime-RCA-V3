import type { AttributeMappingPreviewView } from '@/api/v2/types/integration-mappings';
import { DurationText } from '@/features/ux-kit/duration-text';
import { NumberText } from '@/features/ux-kit/number-text';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { formatValue } from '../model/mapping-draft';

const DURATION_FACT = 'suppliedDurationSeconds';

function FieldList({ title, values, testId }: { title: string; values: Record<string, unknown>; testId: string }) {
  const entries = Object.entries(values);
  return (
    <div>
      <h4 className="text-sm font-medium">{title}</h4>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">none</p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-sm" data-testid={testId}>
          {entries.map(([name, value]) => (
            <div key={name} className="contents" data-testid="mapped-value" data-field={name} data-value={formatValue(value)}>
              <dt className="text-muted-foreground">{name}</dt>
              <dd>
                {name === DURATION_FACT && typeof value === 'number' ? (
                  <>
                    <DurationText seconds={value} /> (<NumberText value={value} /> s)
                  </>
                ) : (
                  formatValue(value)
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** What the sample becomes under the (draft) rules, as the server mapped it; nothing was stored. */
export function MappingPreview({ preview, timezone }: { preview: AttributeMappingPreviewView; timezone: string }) {
  return (
    <section aria-label="Mapping preview" className="space-y-3 rounded-md border p-3" data-testid="mapping-preview" data-diagnostics={preview.diagnostics.length}>
      <p className="text-sm">
        {preview.eventType} event · <PlantTime iso={preview.startTime} tz={timezone} withDate withZone={false} /> →{' '}
        {preview.endTime ? <PlantTime iso={preview.endTime} tz={timezone} withDate withZone={false} /> : 'open'} · duration from timestamps:{' '}
        {preview.durationSeconds === null ? 'open' : <DurationText seconds={preview.durationSeconds} />}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldList title="Event fields" values={preview.columns} testId="preview-columns" />
        <FieldList title="Source facts" values={preview.facts} testId="preview-facts" />
      </div>
      {preview.diagnostics.length > 0 ? (
        <ul className="list-disc pl-5 text-sm text-destructive" data-testid="preview-diagnostics">
          {preview.diagnostics.map((entry) => (
            <li key={`${entry.code}-${entry.field ?? ''}`} data-code={entry.code}>
              {entry.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-success">No mapping problems.</p>
      )}
    </section>
  );
}
