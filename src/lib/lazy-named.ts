import { lazy, type ComponentType } from 'react';

/** `React.lazy` for a module's named export (route-level code splitting without default exports). */
export function lazyNamed<TModule, TKey extends keyof TModule>(
  load: () => Promise<TModule>,
  name: TKey,
) {
  return lazy(async () => {
    const module = await load();
    return { default: module[name] as unknown as ComponentType<object> };
  });
}
