import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/** Classes a deep-link target wears briefly (a ring, not colour alone; the announcement says it in words). */
const HIGHLIGHT = ['ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background', 'rounded-md'];
/** Hashes that are not deep-link targets (the skip link). */
const IGNORED = new Set(['main-content']);

export interface HighlightOptions {
  /** how long to wait for the target to render (lazy pages, data still loading) */
  waitMs?: number;
  /** how long the target stays highlighted */
  highlightMs?: number;
}

function labelOf(element: HTMLElement): string {
  return element.dataset.highlightLabel ?? element.getAttribute('aria-label') ?? 'the item from your link';
}

function show(element: HTMLElement, highlightMs: number): () => void {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  element.scrollIntoView?.({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
  if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
  element.focus({ preventScroll: true });
  element.classList.add(...HIGHLIGHT);
  element.dataset.highlighted = 'true';
  const timer = window.setTimeout(() => {
    element.classList.remove(...HIGHLIGHT);
    delete element.dataset.highlighted;
  }, highlightMs);
  return () => window.clearTimeout(timer);
}

/**
 * Deep links to one record (`/planning/profiles/p1#rate-r7`): waits for the element with the hash's id to
 * render, scrolls it into view, focuses it and highlights it briefly. Returns the sentence for a polite
 * live region ("Showing …", or that the item is not on the page any more).
 */
export function useHighlightTarget({ waitMs = 6000, highlightMs = 2500 }: HighlightOptions = {}): string {
  const { hash, pathname, search } = useLocation();
  const [message, setMessage] = useState('');
  useEffect(() => {
    const id = decodeURIComponent(hash.replace(/^#/, ''));
    if (!id || IGNORED.has(id)) return undefined;
    let undo: (() => void) | null = null;
    const apply = (element: HTMLElement) => {
      undo = show(element, highlightMs);
      setMessage(`Showing ${labelOf(element)}.`);
    };
    const found = document.getElementById(id);
    if (found) {
      apply(found);
      return () => undo?.();
    }
    let giveUp = 0;
    const observer = new MutationObserver(() => {
      const element = document.getElementById(id);
      if (!element) return;
      observer.disconnect();
      window.clearTimeout(giveUp);
      apply(element);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    giveUp = window.setTimeout(() => {
      observer.disconnect();
      setMessage('The item from your link is not on this page any more. It may have been decided or moved.');
    }, waitMs);
    return () => {
      observer.disconnect();
      window.clearTimeout(giveUp);
      undo?.();
    };
  }, [hash, pathname, search, waitMs, highlightMs]);
  return message;
}
