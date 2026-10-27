import { readPath } from '../message-fields';
import { parseRfc3339 } from '../time-rules';
import { FeedSpec } from './feed-profile';
import { DOWNTIME_FIELDS, FeedField, PLA_FIELDS } from './feed-templates';

/**
 * Reads the fields of one feed message by their paths (the feed's override, else the template path) and
 * collects every problem naming the field and path, so a quarantine item says exactly what OT must fix.
 */
export class FeedReader {
  readonly problems: string[] = [];
  private readonly template: Readonly<Record<string, FeedField>>;

  constructor(
    private readonly feed: FeedSpec,
    private readonly json: Readonly<Record<string, unknown>>,
  ) {
    this.template = feed.purpose === 'pla' ? PLA_FIELDS : DOWNTIME_FIELDS;
  }

  pathOf(key: string): string {
    return this.feed.fields?.[key] ?? this.template[key].path;
  }

  /** The raw value; a missing required field is a problem. */
  raw(key: string): unknown {
    const value = readPath(this.json, this.pathOf(key));
    if (
      (value === undefined || value === null || value === '') &&
      this.template[key].required
    ) {
      this.problems.push(`${key} (${this.pathOf(key)}) is required`);
    }
    return value === '' ? null : value;
  }

  /** A string field (numbers are read as their text: an id may be numeric). */
  string(key: string): string | null {
    const value = this.raw(key);
    if (value === undefined || value === null) return null;
    if (typeof value === 'string') return value.trim() || null;
    if (typeof value === 'number' && Number.isFinite(value))
      return String(value);
    this.problems.push(
      `${key} (${this.pathOf(key)}) must be text, got ${typeof value}`,
    );
    return null;
  }

  /** A number field; numeric text is accepted ("208.5"). */
  number(key: string): number | null {
    const value = this.raw(key);
    if (value === undefined || value === null) return null;
    const number =
      typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    if (typeof number === 'number' && Number.isFinite(number)) return number;
    this.problems.push(
      `${key} (${this.pathOf(key)}) must be a number, got ${JSON.stringify(value)}`,
    );
    return null;
  }

  /** An instant with an explicit offset or Z (`2026-10-25T00:00:00+03:30`). */
  time(key: string): Date | null {
    const value = this.raw(key);
    if (value === undefined || value === null) return null;
    const parsed = parseRfc3339(value);
    if (parsed.ok) return parsed.at;
    this.problems.push(`${key} (${this.pathOf(key)}): ${parsed.detail}`);
    return null;
  }

  /** A plant date `YYYY-MM-DD`. */
  date(key: string): string | null {
    const value = this.string(key);
    if (value === null) return null;
    if (
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    )
      return value;
    this.problems.push(
      `${key} (${this.pathOf(key)}) must be a date YYYY-MM-DD, got "${value}"`,
    );
    return null;
  }
}
