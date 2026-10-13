import { useEffect } from 'react';

/** Sets the tab title while the sign-in page is mounted and restores the previous one afterwards. */
export function useLoginDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
