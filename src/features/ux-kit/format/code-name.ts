/**
 * The one way a record with a code is named in a picker or tree (QA L2): "Extruder1 — HDPE Extruder 1",
 * as reason codes, assets and units already read in the hierarchy. Tables keep the name alone in their
 * name column.
 */
export function codeNameLabel(record: { code: string; name: string }): string {
  return record.code && record.code !== record.name ? `${record.code} — ${record.name}` : record.name;
}
