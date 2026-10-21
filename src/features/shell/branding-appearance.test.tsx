import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { BrandingView } from '@/api/v2/types/administration';
import { contrastRatio, hslTokenOf, readableTextOn } from './brand-colors';
import { BrandMark, initialsOf } from './brand-mark';
import { brandThemeTokens } from './use-brand-appearance';

const stored = (patch: Partial<BrandingView>): BrandingView =>
  ({ appName: 'Marun Analytics', isStored: true, updatedAt: null, ...patch }) as BrandingView;

describe('branding is applied, not only saved (settings audit, 21 Oct 2026)', () => {
  it('turns brand colours into theme tokens with a readable foreground, only once branding is stored', () => {
    expect(hslTokenOf('#0f172a')).toBe('222.2 47.4% 11.2%');
    expect(readableTextOn('#ffff00')).toBe('#0f172a');
    expect(readableTextOn('#1f3a8a')).toBe('#ffffff');
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21);
    expect(brandThemeTokens({ ...stored({ primaryColor: '#1f3a8a', secondaryColor: '#d62828' }) })).toMatchObject({
      '--primary': hslTokenOf('#1f3a8a'),
      '--ring': hslTokenOf('#1f3a8a'),
      '--primary-foreground': hslTokenOf('#ffffff'),
      '--brand-secondary': hslTokenOf('#d62828'),
    });
    expect(brandThemeTokens({ primaryColor: '#1f3a8a', isStored: false } as BrandingView)).toEqual({});
  });

  it('draws the logo with its size and fit inside a frame the header can hold', () => {
    render(<BrandMark branding={stored({ logoUrl: 'https://cdn.test/logo.png', logoContainerSize: 200, logoSize: 120, logoObjectFit: 'cover', primaryColor: '#1f3a8a' })} />);
    const frame = screen.getByTestId('brand-mark');
    expect(frame.style.width).toBe('48px');
    const img = frame.querySelector('img') as HTMLImageElement;
    expect(img.style.objectFit).toBe('cover');
    expect(Number.parseFloat(img.style.width)).toBeLessThanOrEqual(48);
  });

  it('falls back to readable initials when the logo fails or none is set', () => {
    render(<BrandMark branding={stored({ logoUrl: 'https://cdn.test/broken.png', logoInitials: 'MA', primaryColor: '#ffff00' })} />);
    const frame = screen.getByTestId('brand-mark');
    fireEvent.error(frame.querySelector('img') as HTMLImageElement);
    expect(frame).toHaveTextContent('MA');
    expect(frame.style.color).toBe('rgb(15, 23, 42)');
    expect(initialsOf(stored({ logoInitials: '' }))).toBe('MA');
  });
});
