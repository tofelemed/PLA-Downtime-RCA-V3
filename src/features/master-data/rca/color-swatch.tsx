/** A small decorative colour dot (the checklist's badge colour); the name next to it carries the meaning. */
export function ColorSwatch({ color }: { color: string | null }) {
  if (!color) return null;
  return <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0 rounded-full border" style={{ backgroundColor: color }} />;
}
