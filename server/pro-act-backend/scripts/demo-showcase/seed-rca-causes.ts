/**
 * DEMO RCA cause catalogue of a showcase plant: a small 6M cause library so investigations can record a
 * coded root cause (required before closure). Every entry says "Demo" in its description; existing codes
 * are kept, so re-runs only add what is missing. Illustrative causes only — never product defaults.
 */
import { ShowcaseContext } from './showcase-context';

interface DemoCause {
  code: string;
  name: string;
  category: 'Equipment' | 'Process' | 'Material' | 'Personnel' | 'Environment' | 'Method';
}

const DEMO_CAUSES: readonly DemoCause[] = [
  { code: 'EQ-WEAR', name: 'Component wear beyond service limit', category: 'Equipment' },
  { code: 'EQ-LUBE', name: 'Inadequate lubrication', category: 'Equipment' },
  { code: 'PR-MELT', name: 'Melt temperature or pressure out of window', category: 'Process' },
  { code: 'MA-CONTAM', name: 'Contaminated or off-spec resin feed', category: 'Material' },
  { code: 'ME-PM', name: 'Preventive maintenance interval too long', category: 'Method' },
  { code: 'ME-PROC', name: 'Operating procedure missing or unclear', category: 'Method' },
  { code: 'PE-SKILL', name: 'Task skill or training gap', category: 'Personnel' },
  { code: 'EN-UTIL', name: 'Utility supply disturbance (power, cooling water)', category: 'Environment' },
];

export async function seedRcaCauses(ctx: ShowcaseContext): Promise<void> {
  const author = ctx.as('authors', 0);
  const existing = await author.listAll<{ code: string }>('/v2/rca-causes');
  const known = new Set(existing.map((cause) => cause.code));
  const missing = DEMO_CAUSES.filter((cause) => !known.has(cause.code));
  ctx.tally.add('rca causes (demo)', missing.length, DEMO_CAUSES.length - missing.length, 'Demo 6M cause catalogue');
  if (ctx.dryRun) return;
  for (const cause of missing)
    await author.post('/v2/rca-causes', { ...cause, description: 'Demo cause (showcase catalogue)' }, 'demo rca cause');
}
