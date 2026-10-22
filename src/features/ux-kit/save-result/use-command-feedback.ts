import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { friendlyToastContent, type FieldVocabulary } from '../errors';

/**
 * Runs a command and reports it: a short success toast, or the plain-language error as a red toast (never
 * the code or the raw server text). Rethrows on failure so a `ConfirmDialog` stays open and a form keeps its
 * input. `fields` names the form's fields in a refusal ("Time zone: …" instead of "timezone").
 * For buttons and confirmations (small edits, approvals); forms that create use `useSaveFeedback`.
 */
export function useCommandFeedback(fields?: FieldVocabulary) {
  const { toast } = useToast();
  return useCallback(
    async <T,>(work: () => Promise<T>, success: string): Promise<T> => {
      try {
        const result = await work();
        toast({ title: success });
        return result;
      } catch (error) {
        toast({ ...friendlyToastContent(error, fields), variant: 'destructive' });
        throw error;
      }
    },
    [toast, fields],
  );
}
