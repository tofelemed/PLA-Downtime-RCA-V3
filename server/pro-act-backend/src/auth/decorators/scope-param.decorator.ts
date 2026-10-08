import { SetMetadata } from '@nestjs/common';
import { ScopeParamName } from '../scopes/scope-membership.service';

export const SCOPE_PARAM_KEY = 'scopeParam';

export type ScopeParamSource = 'params' | 'query' | 'body';

export interface ScopeParamSpec {
  /** which hierarchy level the id refers to */
  name: ScopeParamName;
  /** where the id is read from */
  from: ScopeParamSource;
  /** property name in that source (defaults to `name`) */
  key: string;
}

/**
 * Declares that the request carries a tenant/site/unit id that must lie inside the caller's scope;
 * `ScopeGuard` answers 404 (never 403, no existence leak) when it does not.
 *
 * `@ScopeParam('unitId')` reads `params.unitId`; `@ScopeParam('unitId', 'query', 'unitIds')` checks
 * every value of a repeated query parameter.
 */
export const ScopeParam = (
  name: ScopeParamName,
  from: ScopeParamSource = 'params',
  key: string = name,
) => SetMetadata<string, ScopeParamSpec>(SCOPE_PARAM_KEY, { name, from, key });
