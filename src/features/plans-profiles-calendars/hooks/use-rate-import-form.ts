import { useEffect, useRef, useState } from 'react';
import { useCreateRateImport } from '@/api/v2/queries/profile-commands';
import { useRateImportJob } from '@/api/v2/queries/profiles';
import type { RateImportView } from '@/api/v2/types/profiles';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { nextSetupLink, useSaveFeedback } from '@/features/ux-kit/save-result';
import { hasUnsavedChanges, useUnsavedChangesGuard } from '@/features/ux-kit/use-unsaved-changes-guard';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { importBlockedReason, type RateImportInputs } from '../model/rate-import';
import { rateImportResult } from '../profiles/rate-import-result';

export type ImportKind = 'budget' | 'forecast' | 'mpc';

interface ImportFields {
  kind: ImportKind;
  externalId: string;
  csv: string;
  fileRef?: string;
}

const START: ImportFields = { kind: 'forecast', externalId: '', csv: '' };
const LIST = '/setup/profiles';
/** a job that ended with its rates stored (failed jobs keep the form for a corrected file) */
const STORED = new Set(['completed', 'partial']);
const inputsOf = ({ kind, externalId, csv }: ImportFields): RateImportInputs => ({ kind, externalId, csv });

/** Calls `onStored` once per import, when the server's job has stored its rates. */
function useImportStored(importId: string | null, onStored: (view: RateImportView) => void) {
  const view = useRateImportJob(importId).data;
  const reported = useRef<string | null>(null);
  useEffect(() => {
    if (!view || !importId || reported.current === importId || !STORED.has(view.state)) return;
    reported.current = importId;
    onStored(view);
    // reported once per import; `onStored` is a fresh closure each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, importId]);
}

/**
 * State of the rate import page (DECISIONS 2026-10-22 "Save feedback"). An accepted file disables Import
 * until the file, reference or kind changes (no double import); when the server's job has stored the rates
 * the result dialog shows its counts and the form is cleared. A job that refused lines keeps the input
 * (its report lists them); a refused request is the red alert (`failure`), input kept.
 */
export function useRateImportForm(listPath: string = LIST) {
  const [fields, setFields] = useState<ImportFields>(START);
  const [sent, setSent] = useState<RateImportInputs | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  /** remounts the file input, which cannot be cleared through its value */
  const [fileKey, setFileKey] = useState(0);
  const create = useCreateRateImport();
  const feedback = useSaveFeedback();
  const capabilities = useCapabilities();
  const { number } = useNumberFormat();
  const inputs = inputsOf(fields);
  const blocked = importBlockedReason(inputs, sent);
  const sentUnchanged = sent !== null && importBlockedReason(inputs) === null && blocked !== null;
  useUnsavedChangesGuard(hasUnsavedChanges(inputs, inputsOf(START), [create.isPending, sentUnchanged]));

  const clear = () => {
    setFields(START);
    setSent(null);
    setFileKey((key) => key + 1);
    feedback.clearFailure();
  };
  const addAnother = () => {
    clear();
    setImportId(null);
  };

  useImportStored(importId, (view) => {
    feedback.openResult(rateImportResult({ view, count: (value) => number(value), next: nextSetupLink(LIST, { capabilities }), onAddAnother: addAnother, listPath }));
    clear();
  });

  const set = (patch: Partial<ImportFields>) => setFields((current) => ({ ...current, ...patch }));
  const readFile = async (file: File | undefined) => {
    if (file) set({ fileRef: file.name, csv: await file.text() });
  };
  const submit = async () => {
    const body = { kind: fields.kind, externalId: fields.externalId, csv: fields.csv, ...(fields.fileRef ? { fileRef: fields.fileRef } : {}) };
    const accepted = await feedback.run(() => create.submit(body), null).catch(() => null);
    if (!accepted) return;
    setSent(inputs);
    setImportId(accepted.jobId);
  };

  return { fields, set, readFile, submit, blocked, pending: create.isPending, importId, fileKey, failure: feedback.failure, dialog: feedback.dialog };
}
