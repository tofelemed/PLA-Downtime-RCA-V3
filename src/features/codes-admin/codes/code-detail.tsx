import { useState } from 'react';
import type { CodeDetailView, CodeLibraryPath } from '@/api/v2/types/codes-admin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { CodeEditor } from './code-editor';
import { CodeVersions } from './code-versions';
import { MappingPreview } from './mapping-preview';
import { RetireDialog } from './retire-dialog';
import { ValuationLink } from './valuation-link';

export interface CodeDetailProps {
  library: CodeLibraryPath;
  code: CodeDetailView;
  codes: readonly CodeDetailView[];
}

/** Node editor, version history, default mapping preview (reasons) and retire with impact. */
export function CodeDetail({ library, code, codes }: CodeDetailProps) {
  const [retiring, setRetiring] = useState(false);
  const { timezone } = usePlantTimezone();
  return (
    <section className="space-y-3 rounded-md border p-3" data-testid="code-detail" data-code={code.code} data-version={code.version} data-active={code.active}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">
            <span className="font-mono">{code.code}</span> {code.name}
          </h2>
          <p className="text-xs text-muted-foreground">
            Version {code.version} · level {code.level}
            {code.effectiveTo && (
              <>
                {' '}
                · valid until <PlantTime iso={code.effectiveTo} tz={timezone} withDate />
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {code.active ? <Badge variant="outline">active</Badge> : <Badge variant="secondary">retired</Badge>}
          {library === 'impact-codes' && <ValuationLink impactCodeId={code.id} costPerHour={code.costPerHour ?? null} />}
          {code.active && (
            <Button size="sm" variant="destructive" onClick={() => setRetiring(true)} data-testid="code-retire">
              Retire…
            </Button>
          )}
        </div>
      </header>
      <Tabs defaultValue="edit">
        <TabsList>
          <TabsTrigger value="edit">Details</TabsTrigger>
          <TabsTrigger value="versions" data-testid="tab-code-versions">
            Versions
          </TabsTrigger>
          {library === 'reason-codes' && (
            <TabsTrigger value="preview" data-testid="tab-mapping-preview">
              Mapping preview
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="edit">
          <CodeEditor key={`${code.id}:${code.rowVersion}`} library={library} code={code} codes={codes} />
        </TabsContent>
        <TabsContent value="versions">
          <CodeVersions library={library} code={code} codes={codes} timezone={timezone} />
        </TabsContent>
        {library === 'reason-codes' && (
          <TabsContent value="preview">
            <MappingPreview codeId={code.id} />
          </TabsContent>
        )}
      </Tabs>
      {retiring && <RetireDialog library={library} code={code} onClose={() => setRetiring(false)} />}
    </section>
  );
}
