/**
 * Row changes applied at extraction time. Integration connections are seeded inactive and without a
 * secret reference: the operator sets endpoints and credentials on the VM (Settings → Integrations)
 * and activates the connections the plant needs.
 */

type Row = Record<string, unknown>;

const OVERRIDES: Readonly<Record<string, Readonly<Row>>> = {
  integration_connections: { is_active: false, secret_ref: null },
};

/** The row with the table's overrides applied (a new object), or the row itself when there are none. */
export function transformRow(table: string, row: Row): Row {
  const overrides = OVERRIDES[table];
  if (!overrides) return row;
  for (const column of Object.keys(overrides)) {
    if (!(column in row))
      throw new Error(`transform column ${table}.${column} is missing`);
  }
  return { ...row, ...overrides };
}
