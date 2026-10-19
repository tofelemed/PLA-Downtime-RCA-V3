import { useEffect, useMemo } from 'react';
import { flattenPages, useV2InfiniteList } from '@/api/v2/queries/use-v2-list';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { plural } from '@/features/ux-kit/format/plural';

interface TemplateOption {
  id: string;
  name: string;
  nodeCount: number;
}

const NONE = 'none';

/** Active RCA templates of the plant (a lookup list: every page is loaded, never cut off silently). */
function useActiveTemplates() {
  const list = useV2InfiniteList<TemplateOption>({
    resource: 'rca-settings',
    path: '/rca-templates',
    query: { status: 'active', limit: 100 },
    key: { filters: { status: 'active' } },
  });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  return { templates: useMemo(() => flattenPages(list.data?.pages), [list.data]), loading: list.isLoading };
}

/** The template a new case starts from; its logic tree is copied into the case by the server. */
export function TemplateSelect({ value, onChange }: { value: string | null; onChange: (templateId: string | null) => void }) {
  const { number } = useNumberFormat();
  const { templates, loading } = useActiveTemplates();
  return (
    <div className="space-y-1">
      <Label htmlFor="case-template">Template</Label>
      <Select value={value ?? NONE} onValueChange={(next) => onChange(next === NONE ? null : next)} disabled={loading}>
        <SelectTrigger id="case-template">
          <SelectValue placeholder={loading ? 'Loading templates…' : 'No template'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>No template (empty logic tree)</SelectItem>
          {templates.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              {template.name} ({plural(template.nodeCount, 'node', 'nodes', number)})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!loading && templates.length === 0 && <p className="text-xs text-muted-foreground">No active template in this plant.</p>}
    </div>
  );
}
