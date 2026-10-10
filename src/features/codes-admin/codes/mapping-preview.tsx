import { useCodeMappingPreview } from '@/api/v2/queries/codes-admin';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';

const AXES = [
  { key: 'scheduleClass', label: 'Schedule class' },
  { key: 'oeeComponent', label: 'OEE component' },
] as const;

const SOURCES = { code_rule: 'mapping rule', code_default: 'code default' } as const;

/**
 * "Events coded with this reason in the last 30 days would be classified as …" — every count comes
 * from the server (`GET /reason-codes/{id}/mapping-preview`), none is computed here.
 */
export function MappingPreview({ codeId }: { codeId: string }) {
  const preview = useCodeMappingPreview(codeId, 30);
  const data = preview.data;
  return (
    <DataState state={dataStateOf(preview)} error={preview.error}>
      {data && (
        <div className="space-y-2 text-sm" data-testid="mapping-preview" data-events={data.events}>
          <p>
            <strong>{data.events}</strong> event(s) in your scope were coded with this reason in the last 30 days.
          </p>
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                <th className="py-1">Axis</th>
                <th>Default in force now</th>
                <th>Today's classification</th>
                <th>Would differ</th>
              </tr>
            </thead>
            <tbody>
              {AXES.map(({ key, label }) => {
                const proposed = data.proposed[key];
                return (
                  <tr key={key} data-testid="preview-axis" data-axis={key} data-proposed={proposed?.value ?? ''} data-differ={data.wouldDiffer[key]}>
                    <td className="py-1">{label}</td>
                    <td>{proposed ? `${proposed.value} (${SOURCES[proposed.source]}${proposed.ruleVersion ? ` v${proposed.ruleVersion}` : ''})` : 'none'}</td>
                    <td>
                      {Object.entries(data.current[key])
                        .map(([value, count]) => `${value}: ${count}`)
                        .join(', ') || '—'}
                    </td>
                    <td>{proposed ? data.wouldDiffer[key] : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground">Stored events keep their classification; defaults apply to new codings.</p>
        </div>
      )}
    </DataState>
  );
}
