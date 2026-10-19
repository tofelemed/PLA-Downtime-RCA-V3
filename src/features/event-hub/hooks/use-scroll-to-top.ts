import { useEffect } from 'react';

/**
 * QA audit L15: a page opened from a scrolled list starts at its top (the router keeps the window's scroll
 * position). Runs when `key` changes, i.e. once per page or record opened.
 */
export function useScrollToTop(key: string): void {
  useEffect(() => {
    const page = document.scrollingElement ?? document.documentElement;
    page.scrollTop = 0;
  }, [key]);
}
