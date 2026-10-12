import { EntityManager } from 'typeorm';

/** Evidence categories and locations of the tenant (the pick lists of the evidence form). */
export interface RcaEvidenceOptionsV2View {
  categories: string[];
  locations: string[];
}

const LIMIT = 500;

export async function evidenceOptions(
  manager: EntityManager,
  tenantId: string,
): Promise<RcaEvidenceOptionsV2View> {
  const names = async (table: string, column: string): Promise<string[]> => {
    const rows: Array<{ name: string }> = await manager.query(
      `SELECT DISTINCT "${column}" AS name FROM "${table}" WHERE "tenant_id" = $1 AND "${column}" <> '' ORDER BY 1 LIMIT ${LIMIT}`,
      [tenantId],
    );
    return rows.map((row) => row.name);
  };
  return {
    categories: await names('evidence_categories', 'category_name'),
    locations: await names('evidence_locations', 'location_name'),
  };
}
