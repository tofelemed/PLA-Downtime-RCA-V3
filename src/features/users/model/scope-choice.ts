import type { ScopeRole } from '@/api/v2/types/administration';

/** The "Where" value of a grant for the whole plant (otherwise a unit id). */
export const WHOLE_PLANT = 'plant';

/** The role and the place of a new grant, as the two selects hold them. */
export interface ScopeChoice {
  role: string;
  where: string;
}

export const EMPTY_SCOPE_CHOICE: ScopeChoice = { role: '', where: WHOLE_PLANT };

/** The role and optional unit of a grant request. */
export function scopeOf(choice: ScopeChoice): { role: ScopeRole; unitId?: string } {
  return { role: choice.role as ScopeRole, ...(choice.where === WHOLE_PLANT ? {} : { unitId: choice.where }) };
}
