/**
 * BrandingService - Manages application branding configuration
 * Uses backend API for persistence
 */

import { v2Request } from '@/api/v2/client';
import type { BrandingView } from '@/api/v2/types/administration';

export interface BrandingSettings {
  id: string;
  appName: string;
  appSubtitle?: string;
  logoUrl?: string;
  logoInitials?: string;
  primaryColor?: string;
  secondaryColor?: string;
  faviconUrl?: string;
  // Logo styling options
  logoSize?: number; // Logo size in pixels (width/height)
  logoObjectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  logoBorderRadius?: number; // Border radius in pixels
  logoContainerSize?: number; // Container size in pixels
  logoContainerRadius?: number; // Container border radius in pixels
  logoContainerPadding?: number; // Padding inside container in pixels
  logoBackgroundOpacity?: number; // Background gradient opacity (0-1)
  updatedAt: string;
  updatedBy?: string;
}

const DEFAULT_BRANDING: BrandingSettings = {
  id: 'default',
  appName: 'Unified APM',
  appSubtitle: 'Asset Performance Management',
  logoInitials: 'UA',
  primaryColor: '#2563eb', // blue-600
  secondaryColor: '#ec4899', // pink-500
  logoSize: 32, // 32px (w-8 h-8)
  logoObjectFit: 'contain',
  logoBorderRadius: 4, // 4px rounded
  logoContainerSize: 40, // 40px (w-10 h-10)
  logoContainerRadius: 12, // 12px (rounded-xl)
  logoContainerPadding: 0,
  logoBackgroundOpacity: 1,
  updatedAt: new Date().toISOString(),
};

/** The stored branding over the defaults (absent or null fields keep the default). */
function toSettings(view: BrandingView): BrandingSettings {
  const stored = Object.fromEntries(Object.entries(view).filter(([, value]) => value !== null && value !== undefined));
  return {
    ...DEFAULT_BRANDING,
    ...stored,
    id: 'default',
    logoObjectFit: (view.logoObjectFit as BrandingSettings['logoObjectFit']) ?? DEFAULT_BRANDING.logoObjectFit,
    updatedAt: view.updatedAt ?? DEFAULT_BRANDING.updatedAt,
  };
}

class BrandingService {
  /**
   * Current branding from `GET /v2/branding` (caching is left to TanStack Query in `useBranding`);
   * the defaults when the request fails, so the shell always renders.
   */
  async getBranding(): Promise<BrandingSettings> {
    const settings = await v2Request<BrandingView>({ method: 'GET', path: '/branding' })
      .then((response) => toSettings(response.data))
      .catch(() => ({ ...DEFAULT_BRANDING }));
    this.applyBrandingToDocument(settings);
    return settings;
  }

  /**
   * Apply branding to document (title, favicon, meta tags)
   */
  applyBrandingToDocument(settings: BrandingSettings): void {
    // Update document title
    document.title = `${settings.appName}${settings.appSubtitle ? ' - ' + settings.appSubtitle : ''}`;

    // Update meta tags
    const updateMetaTag = (name: string, content: string) => {
      let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = name;
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    const updateOGTag = (property: string, content: string) => {
      let meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('property', property);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    updateMetaTag('apple-mobile-web-app-title', settings.appName);
    updateOGTag('og:title', `${settings.appName}${settings.appSubtitle ? ' - ' + settings.appSubtitle : ''}`);

    // Update theme color if provided
    if (settings.primaryColor) {
      let themeColor = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
      if (!themeColor) {
        themeColor = document.createElement('meta');
        themeColor.name = 'theme-color';
        document.head.appendChild(themeColor);
      }
      themeColor.content = settings.primaryColor;
    }

    // Update favicon if provided
    if (settings.faviconUrl) {
      let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        document.head.appendChild(favicon);
      }
      favicon.href = settings.faviconUrl;

      let appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
      if (!appleTouchIcon) {
        appleTouchIcon = document.createElement('link');
        appleTouchIcon.rel = 'apple-touch-icon';
        document.head.appendChild(appleTouchIcon);
      }
      appleTouchIcon.href = settings.faviconUrl;
    }
  }

  /**
   * Get default branding settings
   */
  getDefaultBranding(): BrandingSettings {
    return { ...DEFAULT_BRANDING };
  }
}

export const brandingService = new BrandingService();

