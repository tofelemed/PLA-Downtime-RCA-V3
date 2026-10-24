import type { CodeLibraryPath } from '@/api/v2/types/codes-admin';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { FIELD_CLASS } from '@/features/pla-analytics/components/filter-classes';
import { RcaCard } from '@/features/rca/components/rca-card';
import { LabelledSearch } from '@/features/master-data/components/labelled-search';
import { useUrlParam } from '../hooks/use-url-param';
import { useUrlText } from '../hooks/use-url-text';
import { LIBRARIES, LIBRARY_PATHS } from '../model/code-fields';
import { CodeFlatTable } from './code-flat-table';
import { CodeSearchResults } from './code-search-results';
import { CodeTree } from './code-tree';
import { pageNameOf } from '@/features/auth/navigation-items';
import { sectionNameOf } from '@/features/master-data/components/master-data-sections';

const LIBRARY_OPTIONS = LIBRARY_PATHS.map((path) => ({ value: path, label: LIBRARIES[path].label }));
const SHOWN = ['active', 'all'] as const;

/** Library picker, search and "Show retired" above the chosen library ("New code" is in the page header). */
function Toolbar({ library, setLibrary }: { library: CodeLibraryPath; setLibrary: (next: CodeLibraryPath) => void }) {
  const [shown, setShown] = useUrlParam('show', SHOWN, 'active');
  const [query, setQuery] = useUrlText('q');
  return (
    <div className="flex flex-wrap items-end gap-3" data-testid="code-library-filters">
      <div className={`${FIELD_CLASS} w-56`}>
        <Label htmlFor="code-library">Library</Label>
        <NativeSelect id="code-library" testId="code-library-select" value={library} onChange={(value) => setLibrary(value as CodeLibraryPath)} options={LIBRARY_OPTIONS} />
      </div>
      <LabelledSearch label="Search codes" placeholder="Search by code or name" value={query} onChange={setQuery} />
      <div className="flex h-9 items-center gap-2">
        <Checkbox id="codes-retired" checked={shown === 'all'} onCheckedChange={(value) => setShown(value === true ? 'all' : 'active')} />
        <Label htmlFor="codes-retired">Show retired</Label>
      </div>
    </div>
  );
}

/** Where root causes live, behind the codes card's ⓘ (the RCA cause library is master data, not a code library). */
const CAUSES_INFO = `Root causes for investigations are kept in ${pageNameOf('/master-data/rca/templates')} › ${sectionNameOf('/master-data/rca/causes')}.`;

/**
 * The "Code libraries" tab: one library at a time (chosen in the URL), its tree or table in a report card,
 * a search that finds codes at any depth.
 */
export function CodeLibraryBrowser() {
  const [library, setLibrary] = useUrlParam<CodeLibraryPath>('library', LIBRARY_PATHS, 'reason-codes');
  const [shown] = useUrlParam('show', SHOWN, 'active');
  const [query] = useUrlText('q');
  const includeRetired = shown === 'all';
  const body = query.trim()
    ? <CodeSearchResults library={library} includeRetired={includeRetired} text={query} />
    : LIBRARIES[library].hierarchical
      ? <CodeTree key={`${library}:${includeRetired}`} library={library} includeRetired={includeRetired} />
      : <CodeFlatTable library={library} includeRetired={includeRetired} />;
  return (
    <div className="space-y-4" data-testid="code-library" data-library={library}>
      <Toolbar library={library} setLibrary={setLibrary} />
      <RcaCard title={LIBRARIES[library].label} info={CAUSES_INFO} testId="code-library-card">
        {body}
      </RcaCard>
    </div>
  );
}
