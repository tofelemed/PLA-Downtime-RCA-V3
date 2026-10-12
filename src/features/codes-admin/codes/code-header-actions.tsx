import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CodeDetailView, CodeLibraryPath } from '@/api/v2/types/codes-admin';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ActionIcon } from '@/lib/icons';
import { LIBRARIES } from '../model/code-fields';
import { canHaveChildren } from '../model/code-tree';
import { CodeCreateDialog } from './code-create-dialog';
import { CodeRetireAction } from './code-retire-action';
import { ValuationLink } from './valuation-link';

export interface CodeHeaderActionsProps {
  library: CodeLibraryPath;
  code: CodeDetailView;
}

/** Header actions of a code page: valuation link (impact codes), new sub-code, retire. */
export function CodeHeaderActions({ library, code }: CodeHeaderActionsProps) {
  const { canWriteCodes } = useCapabilities();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const canAddChild = canWriteCodes && code.active && LIBRARIES[library].hierarchical && canHaveChildren(code);
  return (
    <>
      {library === 'impact-codes' && <ValuationLink impactCodeId={code.id} costPerHour={code.costPerHour ?? null} />}
      {canAddChild && (
        <Button variant="outline" onClick={() => setCreating(true)} data-testid="code-new-child">
          <ActionIcon.add aria-hidden="true" />
          New sub-code
        </Button>
      )}
      {canWriteCodes && code.active && <CodeRetireAction library={library} code={code} />}
      {creating && (
        <CodeCreateDialog library={library} parentId={code.id} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); navigate(`/codes-admin/${library}/${id}`); }} />
      )}
    </>
  );
}
