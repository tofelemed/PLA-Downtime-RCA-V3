import { useEffect, useState, type CSSProperties } from 'react';
import type { BrandingView } from '@/api/v2/types/administration';
import { readableTextOn } from './brand-colors';

/** The header is 56 px high: the logo frame never grows past this, whatever size is configured. */
const FRAME_MAX = 48;
const FRAME_MIN = 24;

const clamp = (value: number | undefined, fallback: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value ?? fallback));

/** Initials to show without a logo: the configured ones, else the first letters of the name. */
export function initialsOf(branding: Pick<BrandingView, 'logoInitials' | 'appName'> | undefined): string {
  if (branding?.logoInitials) return branding.logoInitials;
  const words = (branding?.appName ?? 'Traverse Forge').trim().split(/\s+/);
  return words.slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join('');
}

/** `#rrggbb` with an opacity as `rgba(...)`, for the frame background. */
function withOpacity(hex: string, opacity: number): string {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return hex;
  const [r, g, b] = match.slice(1).map((part) => parseInt(part, 16));
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function frameStyle(branding: BrandingView | undefined): CSSProperties {
  const size = clamp(branding?.logoContainerSize, 40, FRAME_MIN, FRAME_MAX);
  const background = branding?.primaryColor;
  return {
    width: size,
    height: size,
    borderRadius: clamp(branding?.logoContainerRadius, 12, 0, size / 2),
    padding: clamp(branding?.logoContainerPadding, 0, 0, size / 4),
    // the tenant's colour when set, else the theme's primary (tokens, never a built-in hex)
    background: background ? withOpacity(background, clamp(branding?.logoBackgroundOpacity, 1, 0, 1)) : 'hsl(var(--primary))',
    color: background ? readableTextOn(background) : 'hsl(var(--primary-foreground))',
  };
}

/**
 * The brand tile of the header: the configured logo with its size, fit and corners inside a frame of the
 * primary colour, or the initials in a colour that reads on it; a logo that fails to load falls back to the
 * initials (settings audit, 21 Oct 2026: these settings were saved but never applied).
 */
export function BrandMark({ branding }: { branding: BrandingView | undefined }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [branding?.logoUrl]);
  const frame = frameStyle(branding);
  const inner = Number(frame.width) - 2 * Number(frame.padding ?? 0);
  const logoSize = clamp(branding?.logoSize, inner, 8, inner);
  const showLogo = Boolean(branding?.logoUrl) && !broken;
  return (
    <span className="flex shrink-0 items-center justify-center overflow-hidden text-xs font-bold" style={frame} aria-hidden data-testid="brand-mark">
      {showLogo ? (
        <img
          src={branding?.logoUrl}
          alt=""
          onError={() => setBroken(true)}
          style={{ width: logoSize, height: logoSize, objectFit: (branding?.logoObjectFit as CSSProperties['objectFit']) ?? 'contain', borderRadius: branding?.logoBorderRadius ?? 4 }}
        />
      ) : (
        initialsOf(branding)
      )}
    </span>
  );
}
