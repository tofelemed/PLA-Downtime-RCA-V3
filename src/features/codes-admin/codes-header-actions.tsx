import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CodeLibraryPath } from '@/api/v2/types/codes-admin';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ActionIcon } from '@/lib/icons';
import { CodeCreateDialog } from './codes/code-create-dialog';
import { useUrlParam } from './hooks/use-url-param';
import { LIBRARY_PATHS } from './model/code-fields';

/** "New code" in the chosen library (`?library=`), its create dialog mounted while open. */
function NewCodeButton() {
  const [library] = useUrlParam<CodeLibraryPath>('library', LIBRARY_PATHS, 'reason-codes');
  const [creating, setCreating] = useState(false);
  return (
    <>
      <Button onClick={() => setCreating(true)} data-testid="code-new">
        <ActionIcon.add aria-hidden="true" />
        New code
      </Button>
      {creating && <CodeCreateDialog library={library} parentId={null} onClose={() => setCreating(false)} />}
    </>
  );
}

function NewRuleButton() {
  const navigate = useNavigate();
  return (
    <Button onClick={() => navigate('/master-data/codes-rules/rules/new')} data-testid="rule-new">
      <ActionIcon.add aria-hidden="true" />
      New rule
    </Button>
  );
}

/**
 * The add action of the active Codes & rules tab, in the page header (SETUP_UX_FIXES Phase 4): "New code"
 * for writers of codes, "New rule" for rule authors. The header's Read-only hint covers everyone else.
 */
export function CodesHeaderActions({ tab }: { tab: 'codes' | 'rules' }) {
  const { canWriteCodes, canAuthorRules } = useCapabilities();
  if (tab === 'rules') return canAuthorRules ? <NewRuleButton /> : null;
  return canWriteCodes ? <NewCodeButton /> : null;
}
