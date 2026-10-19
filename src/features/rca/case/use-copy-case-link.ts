import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

/** The investigation's address without filters or tabs state in the query. */
export const caseLinkOf = (href: string): string => href.split('?')[0];

/**
 * "Copy link to this investigation" (QA L13): awaits the clipboard and says what happened — a toast on
 * success, and one that shows the link to copy by hand when the browser refuses (no permission, no API).
 */
export function useCopyCaseLink(): () => Promise<void> {
  const { toast } = useToast();
  return useCallback(async () => {
    const link = caseLinkOf(window.location.href);
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(link);
      toast({ title: 'Link copied', description: 'The link to this investigation is on your clipboard.' });
    } catch {
      toast({ title: 'Could not copy the link', description: `Your browser did not allow copying. Copy it from here: ${link}`, variant: 'destructive' });
    }
  }, [toast]);
}
