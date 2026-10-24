/** The plan page's meta line: the unit name and the version number, joined only when both are present. */
export function planMetaText(unitName: string, version: number): string {
  return [unitName.trim(), `Version ${version}`].filter(Boolean).join(' · ');
}
