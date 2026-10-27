import { V2ApiError, type FieldError } from '@/api/v2/errors';
import type { FeedErrors, FeedFieldName, FeedProblems } from './feeds';

const FEED_PATH = /^endpointConfig\.payloadProfile\.feeds(?:(?:\[(\d+)\]|\.(\d+))(?:\.(\w+)(?:\.(\w+))?)?)?$/;
const FEED_KEYS: readonly FeedFieldName[] = ['id', 'purpose', 'topic', 'unitId', 'productId', 'durationUnit'];

function add(problems: FeedProblems, key: string | undefined, field: string | undefined, message: string): void {
  if (key === 'fields') {
    const fields = { ...problems.fields };
    const at = field ?? '';
    fields[at] = fields[at] ? `${fields[at]}; ${message}` : message;
    problems.fields = fields;
    return;
  }
  const name = FEED_KEYS.find((entry) => entry === key) ?? 'topic';
  problems[name] = problems[name] ? `${problems[name]}; ${message}` : message;
}

/**
 * Server 422 field errors on `endpointConfig.payloadProfile.feeds[i].<x>` (or `.fields.<key>`) as feed
 * errors; `feeds` itself lands on the list. Other paths are not feed errors.
 */
export function feedErrorsFromFieldErrors(fieldErrors: readonly FieldError[]): FeedErrors {
  const errors: FeedErrors = { byFeed: {} };
  for (const entry of fieldErrors) {
    const match = FEED_PATH.exec(entry.field);
    if (!match) continue;
    const index = match[1] ?? match[2];
    if (index === undefined) {
      errors.list = errors.list ? `${errors.list}; ${entry.message}` : entry.message;
      continue;
    }
    const problems = errors.byFeed[Number(index)] ?? {};
    add(problems, match[3], match[4], entry.message);
    errors.byFeed[Number(index)] = problems;
  }
  return errors;
}

export function feedErrorsFromError(error: unknown): FeedErrors {
  return error instanceof V2ApiError ? feedErrorsFromFieldErrors(error.fieldErrors) : { byFeed: {} };
}

/** Client and server errors together (client first per field). */
export function mergeFeedErrors(first: FeedErrors, second: FeedErrors): FeedErrors {
  const byFeed: Record<number, FeedProblems> = { ...second.byFeed };
  for (const [index, problems] of Object.entries(first.byFeed)) {
    const other = byFeed[Number(index)] ?? {};
    byFeed[Number(index)] = { ...other, ...problems, ...(problems.fields || other.fields ? { fields: { ...other.fields, ...problems.fields } } : {}) };
  }
  const list = first.list ?? second.list;
  return list ? { list, byFeed } : { byFeed };
}
