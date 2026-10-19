import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { friendlyToastContent, type FieldVocabulary } from '@/features/ux-kit/errors';

/**
 * Runs a command and reports it: a short success toast, or the plain-language error (never the code or
 * the raw server text). Rethrows on failure so a `ConfirmDialog` stays open and a form keeps its input.
 * `fields` names the form's fields in a refusal ("Time zone: …" instead of "timezone").
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
