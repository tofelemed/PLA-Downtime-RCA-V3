/**
 * A count with the right noun for messages people read (QA: "1 stop(s)"): `plural(1, 'stop', 'stops')`
 * → "1 stop", `plural(3, 'stop', 'stops')` → "3 stops". Log lines may stay terse.
 */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
