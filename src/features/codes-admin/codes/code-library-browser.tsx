import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CodeLibraryPath } from '@/api/v2/types/codes-admin';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { DebouncedSearchInput } from '@/features/ux-kit/debounced-search-input';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { ActionIcon } from '@/lib/icons';
import { useUrlParam } from '../hooks/use-url-param';
import { useUrlText } from '../hooks/use-url-text';
import { LIBRARIES, LIBRARY_PATHS } from '../model/code-fields';
import { CodeCreateDialog } from './code-create-dialog';
import { CodeFlatTable } from './code-flat-table';
import { CodeSearchResults } from './code-search-results';
import { CodeTree } from './code-tree';
import { sectionNameOf } from '@/features/master-data/components/master-data-sections';

const LIBRARY_OPTIONS = LIBRARY_PATHS.map((path) => ({ value: path, label: LIBRARIES[path].label }));
const SHOWN = ['active', 'all'] as const;

/** Library picker, search, "Show retired" and "New code" above the chosen library. */
function Toolbar({ library, setLibrary }: { library: CodeLibraryPath; setLibrary: (next: CodeLibraryPath) => void }) {
  const { canWriteCodes } = useCapabilities();
  const [shown, setShown] = useUrlParam('show', SHOWN, 'active');
  const [query, setQuery] = useUrlText('q');
  const [creating, setCreating] = useState(false);
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-56 space-y-1">
        <Label htmlFor="code-library">Library</Label>
        <NativeSelect id="code-library" testId="code-library-select" value={library} onChange={(value) => setLibrary(value as CodeLibraryPath)} options={LIBRARY_OPTIONS} />
      </div>
      <DebouncedSearchInput label="Search codes" placeholder="Search by code or name" value={query} onChange={setQuery} />
      <div className="flex h-9 items-center gap-2">
        <Checkbox id="codes-retired" checked={shown === 'all'} onCheckedChange={(value) => setShown(value === true ? 'all' : 'active')} />
        <Label htmlFor="codes-retired">Show retired</Label>
      </div>
      <div className="ml-auto">
        {canWriteCodes ? (
          <Button onClick={() => setCreating(true)} data-testid="code-new">
            <ActionIcon.add aria-hidden="true" />
            New code
          </Button>
        ) : (
          <ReadOnlyHint />
        )}
      </div>
      {creating && (
        <CodeCreateDialog library={library} parentId={null} onClose={() => setCreating(false)} />
      )}
    </div>
  );
}

/**
 * The "Code libraries" tab: one library at a time (chosen in the URL), its tree or table, a search that
 * finds codes at any depth. The RCA cause library is master data (Master data › Cause library).
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
      {body}
      <p className="text-sm text-muted-foreground">
        Root causes for investigations are kept in Master data ›{' '}
        <Link className="underline" to="/master-data/rca/causes">
          {sectionNameOf('/master-data/rca/causes')}
        </Link>
        .
      </p>
    </div>
  );
}
