/**
 * Shared pieces of the read-only verification: the check record, the plant references every check needs
 * (resolved by code, so `--verify-only` works on its own) and small helpers. Reads use the SuperAdmin.
 */
import { OPERATING_MODE, PRODUCTS, UNIT } from './train-catalog';
import { TrainContext } from './train-context';
import { TrainSession } from './train-session';

export interface Check {
  area: string;
  ok: boolean;
  detail: string;
  ids?: string[];
}

export interface Refs {
  reader: TrainSession;
  unitId: string | null;
  /** product code → id */
  products: Map<string, string>;
  /** product code → approved profile id */
  profiles: Map<string, string>;
}

interface Row {
  id: string;
  code: string;
}

interface ProfileRow {
  id: string;
  productId: string;
  operatingMode: string;
  state: string;
}

export const check = (
  area: string,
  ok: boolean,
  detail: string,
  ids: string[] = [],
): Check => ({
  area,
  ok,
  detail,
  ids,
});

/** Instant `at` lies in [from, to). */
export function covers(from: string, to: string | null, at: string): boolean {
  const instant = Date.parse(at);
  return (
    Date.parse(from) <= instant && (to === null || instant < Date.parse(to))
  );
}

export async function resolveRefs(ctx: TrainContext): Promise<Refs> {
  const reader = ctx.admin();
  const units = await reader.listAll<Row>('/v2/units');
  const unitId = units.find((u) => u.code === UNIT.code)?.id ?? null;
  const productRows = await reader.listAll<Row>('/v2/products');
  const products = new Map<string, string>();
  for (const spec of PRODUCTS) {
    const id = productRows.find((p) => p.code === spec.code)?.id;
    if (id) products.set(spec.code, id);
  }
  const profiles = new Map<string, string>();
  if (unitId) {
    const rows = await reader.listAll<ProfileRow>('/v2/profiles', { unitId });
    for (const [code, productId] of products) {
      const approved = rows.find(
        (p) =>
          p.productId === productId &&
          p.operatingMode === OPERATING_MODE &&
          p.state === 'approved',
      );
      if (approved) profiles.set(code, approved.id);
    }
  }
  return { reader, unitId, products, profiles };
}
