import { useEffect } from 'react';
import type { BrandingView } from '@/api/v2/types/administration';
import { hslTokenOf, readableTextOn } from './brand-colors';

const DEFAULT_ICON = '/favicon.svg';

/** The theme variables a stored branding sets on `:root` (settings audit, 21 Oct 2026). */
export function brandThemeTokens(branding: Pick<BrandingView, 'primaryColor' | 'secondaryColor' | 'isStored'> | undefined): Record<string, string> {
  if (!branding?.isStored) return {};
  const tokens: Record<string, string> = {};
  const primary = hslTokenOf(branding.primaryColor);
  if (primary) {
    tokens['--primary'] = primary;
    tokens['--ring'] = primary;
    tokens['--primary-foreground'] = hslTokenOf(readableTextOn(branding.primaryColor)) ?? '';
  }
  const secondary = hslTokenOf(branding.secondaryColor);
  if (secondary) tokens['--brand-secondary'] = secondary;
  return tokens;
}

/** Points the page's browser icon at `href` (one `<link rel="icon">`, created when missing). */
function setIcon(href: string): void {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
}

/**
 * Applies the configured branding to the page: the primary colour becomes the app's primary theme colour
 * (buttons, links, focus rings, charts that use the token) with a readable text colour on it, the secondary
 * colour the accent of the header, and the browser icon the configured one (else the logo, else the default).
 * While no branding is stored the built-in theme stays.
 */
export function useBrandAppearance(branding: BrandingView | undefined): void {
  useEffect(() => {
    const root = document.documentElement;
    const tokens = brandThemeTokens(branding);
    for (const [name, value] of Object.entries(tokens)) root.style.setProperty(name, value);
    return () => {
      for (const name of Object.keys(tokens)) root.style.removeProperty(name);
    };
  }, [branding]);
  useEffect(() => {
    setIcon(branding?.faviconUrl || branding?.logoUrl || DEFAULT_ICON);
  }, [branding?.faviconUrl, branding?.logoUrl]);
}
