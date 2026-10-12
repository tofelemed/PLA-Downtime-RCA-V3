import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/** A lazily loaded route page whose chunk can be fetched ahead of navigation (menu hover, flag wait). */
export type PreloadablePage = LazyExoticComponent<ComponentType<object>> & {
  /** starts (or reuses) the chunk download; safe to call many times */
  preload: () => Promise<unknown>;
};

type PageModule = { default: ComponentType<object> };

/** `React.lazy` with a memoised `preload()`; a failed download is retried on the next call. */
export function lazyWithPreload(load: () => Promise<PageModule>): PreloadablePage {
  let pending: Promise<PageModule> | null = null;
  const loader = (): Promise<PageModule> => {
    pending ??= load().catch((error: unknown) => {
      pending = null;
      throw error;
    });
    return pending;
  };
  return Object.assign(lazy(loader), { preload: loader });
}

/** `lazyWithPreload` for a module's named export (pages use named exports). */
export function lazyNamedWithPreload<TModule, TKey extends keyof TModule>(
  load: () => Promise<TModule>,
  name: TKey,
): PreloadablePage {
  return lazyWithPreload(async () => {
    const module = await load();
    return { default: module[name] as unknown as ComponentType<object> };
  });
}
