import type { Capabilities } from '@/features/auth/capabilities';
import { SETUP_STEPS, canOpenStep, type SetupStep } from '@/features/equipment-setup/setup-steps';
import { MASTER_DATA_SECTIONS, type MasterDataSection } from '@/features/master-data/components/master-data-sections';
import type { SaveLink } from './save-result';

export interface NextSetupLinkOptions {
  /** the production unit the user works on: unit-scoped pages open it (`?unitId=`) */
  unitId?: string;
  /** skip pages the user cannot open */
  capabilities?: Capabilities;
}

const pathOnly = (path: string) => path.split(/[?#]/)[0];
const covers = (base: string, path: string) => path === base || path.startsWith(`${base}/`);
const basePathOf = (step: SetupStep) => pathOnly(step.to({ unitId: '' }));

/** Paths a step owns: its page, then its related pages without a query (a query names a tab of another page). */
function pathsOf(step: SetupStep): string[] {
  const related = (step.related ?? []).map((link) => link.to).filter((to) => !to.includes('?'));
  return [basePathOf(step), ...related];
}

/** Index of the setup step whose page (longest match; its own page before a related one) holds `path`. */
function stepIndexOf(path: string): number {
  let best = { index: -1, score: 0 };
  SETUP_STEPS.forEach((step, index) => {
    pathsOf(step).forEach((base, order) => {
      const score = covers(base, path) ? base.length * 2 + (order === 0 ? 1 : 0) : 0;
      if (score > best.score) best = { index, score };
    });
  });
  return best.index;
}

function nextStep(index: number, options: NextSetupLinkOptions): SaveLink | null {
  const current = basePathOf(SETUP_STEPS[index]);
  const step = SETUP_STEPS.slice(index + 1).find(
    (candidate) => basePathOf(candidate) !== current && (!options.capabilities || canOpenStep(candidate, options.capabilities)),
  );
  return step ? { label: step.page, path: step.to({ unitId: options.unitId ?? '' }) } : null;
}

/** Pages outside the guide (RCA libraries, plant flow, …): the next page of the same master-data group. */
function nextSection(path: string, capabilities: Capabilities | undefined): SaveLink | null {
  const sections = MASTER_DATA_SECTIONS.filter((section) => !section.end);
  const own = sections.filter((section) => covers(section.to, path)).sort((a, b) => b.to.length - a.to.length)[0];
  if (!own) return null;
  const visible = (section: MasterDataSection) => !capabilities || section.visible(capabilities);
  const next = sections.slice(sections.indexOf(own) + 1).find((section) => section.group === own.group && visible(section));
  return next ? { label: next.label, path: next.to } : null;
}

/**
 * The "Next: <page>" link of the result dialog: the Setup guide step after the one the current page belongs
 * to (Organizations & plants → Production units → Assets → Products → Codes & rules → …), skipping steps on
 * the same page and, with `capabilities`, pages the user cannot open. Pages outside the guide fall back to
 * the next tab of their master-data group. Null when there is no next page.
 *
 * @example nextSetupLink('/master-data/units/new') // { label: 'Assets', path: '/master-data/assets' }
 * @example nextSetupLink('/master-data/codes-rules', { unitId: 'u1' }) // { label: 'Stop and plan policy', path: '/master-data/stop-policy?unitId=u1' }
 */
export function nextSetupLink(currentPath: string, options: NextSetupLinkOptions = {}): SaveLink | null {
  const path = pathOnly(currentPath);
  const index = stepIndexOf(path);
  return index >= 0 ? nextStep(index, options) : nextSection(path, options.capabilities);
}
