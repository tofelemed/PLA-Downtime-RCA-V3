import { useState } from 'react';
import type { CodeCreateBody } from '@/api/v2/queries/codes-admin';
import type { CodeLibraryPath, FailureGroupKind } from '@/api/v2/types/codes-admin';
import { LIBRARIES } from '../model/code-fields';

/** Values of the new-code dialog; `reset` empties them for "Add another" (the proposed parent stays). */
export function useNewCodeForm(library: CodeLibraryPath, initialParent: string) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [parent, setParent] = useState(initialParent);
  const [groupKind, setGroupKind] = useState<FailureGroupKind>('class');
  const body = (): CodeCreateBody => {
    const value: CodeCreateBody = { code: code.trim(), name: name.trim() };
    if (LIBRARIES[library].hierarchical) value.parentId = parent || null;
    if (library === 'failure-code-groups') value.groupKind = groupKind;
    return value;
  };
  const reset = () => {
    setCode('');
    setName('');
  };
  return { code, setCode, name, setName, parent, setParent, groupKind, setGroupKind, body, reset };
}
