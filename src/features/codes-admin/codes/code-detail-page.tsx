import { useParams } from 'react-router-dom';
import { useCode } from '@/api/v2/queries/codes-admin';
import type { CodeDetailView, CodeLibraryPath } from '@/api/v2/types/codes-admin';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { usePlantDates } from '../hooks/use-plant-dates';
import { useUrlParam } from '../hooks/use-url-param';
import { isCodeLibrary, LIBRARIES, singularLabel } from '../model/code-fields';
import { CodeEditor } from './code-editor';
import { CodeHeaderActions } from './code-header-actions';
import { CodeMappingsTab } from './code-mappings-tab';
import { CodeMoveForm } from './code-move-form';
import { CodeStatusBadge } from './code-status-badge';
import { CodeVersions } from './code-versions';
import { sectionNameOf } from '@/features/master-data/components/master-data-sections';

const TABS = ['details', 'mappings', 'versions'] as const;
type CodeTab = (typeof TABS)[number];

function Summary({ library, code }: { library: CodeLibraryPath; code: CodeDetailView }) {
  const dates = usePlantDates();
  return (
    <span className="flex flex-wrap items-center gap-2">
      <CodeStatusBadge active={code.active} />
      <span>
        {singularLabel(library)} · version {code.version}
        {code.effectiveTo ? ` · valid until ${dates.dateTime(code.effectiveTo)}` : ''}
      </span>
    </span>
  );
}

function CodeTabs({ library, code }: { library: CodeLibraryPath; code: CodeDetailView }) {
  const isReason = library === 'reason-codes';
  const [tab, setTab] = useUrlParam<CodeTab>('tab', isReason ? TABS : ['details', 'versions'], 'details');
  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as CodeTab)}>
      <TabsList className="h-auto flex-wrap">
        <TabsTrigger value="details" data-testid="tab-code-details">Details</TabsTrigger>
        {isReason && <TabsTrigger value="mappings" data-testid="tab-code-mappings">Default mappings</TabsTrigger>}
        <TabsTrigger value="versions" data-testid="tab-code-versions">Versions</TabsTrigger>
      </TabsList>
      <TabsContent value="details" className="space-y-6 pt-4">
        <CodeEditor key={`${code.id}:${code.rowVersion}`} library={library} code={code} />
        {LIBRARIES[library].hierarchical && code.active && (
          <Section title="Position in the tree" headingLevel={3}>
            <CodeMoveForm key={`${code.id}:${code.rowVersion}`} library={library} code={code} />
          </Section>
        )}
      </TabsContent>
      {isReason && (
        <TabsContent value="mappings" className="pt-4">
          <CodeMappingsTab reasonId={code.id} active={code.active} />
        </TabsContent>
      )}
      <TabsContent value="versions" className="pt-4">
        <CodeVersions library={library} code={code} />
      </TabsContent>
    </Tabs>
  );
}

function CodePage({ library, codeId }: { library: CodeLibraryPath; codeId: string }) {
  const query = useCode(library, codeId);
  const code = query.data;
  const back = { to: `/master-data/codes-rules?library=${library}`, label: sectionNameOf('/master-data/codes-rules') };
  if (!code) {
    return (
      <Page>
        <PageHeader title={singularLabel(library)} back={back} />
        <DataState state={dataStateOf(query)} error={query.error} onRetry={() => void query.refetch()} />
      </Page>
    );
  }
  return (
    <Page>
      <div className="space-y-6" data-testid="code-detail" data-code={code.code} data-version={code.version} data-active={code.active}>
        <PageHeader title={`${code.code} — ${code.name}`} back={back} description={<Summary library={library} code={code} />} actions={<CodeHeaderActions library={library} code={code} />} />
        <CodeTabs library={library} code={code} />
      </div>
    </Page>
  );
}

/** `/master-data/codes-rules/:library/:codeId`: one code with its editor, default mappings and version history. */
export function CodeDetailPage() {
  const { library, codeId } = useParams();
  if (!isCodeLibrary(library) || !codeId) {
    return (
      <Page>
        <PageHeader title="Code not found" back={{ to: '/master-data/codes-rules', label: sectionNameOf('/master-data/codes-rules') }} />
        <DataState state="empty" detail="This address does not name a code library." />
      </Page>
    );
  }
  return <CodePage key={`${library}:${codeId}`} library={library} codeId={codeId} />;
}
