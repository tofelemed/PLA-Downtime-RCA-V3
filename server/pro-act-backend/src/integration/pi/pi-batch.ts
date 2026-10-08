import { envInt } from '../../common/helpers/time-bounds';
import { PiHttpClient, PiRequestError } from './pi-http-client';

/** The answer to one GET of a batch. */
export interface BatchAnswer {
  status: number;
  content: unknown;
}

export interface ManyResult {
  answers: BatchAnswer[];
  /** the installation has no batch controller: the caller records `capabilities.batch = false` */
  batchUnsupported: boolean;
}

interface BatchItem {
  Status?: unknown;
  Content?: unknown;
}

/**
 * GETs many PI resources (PI02 batched reads, I13): one `POST /batch` per chunk of `PI_BATCH_SIZE`
 * (250) requests when the connection supports it, else one GET per resource. Answers keep the order of
 * `paths`; a 404 is an answer, any other failure throws (a page is never half read).
 */
export async function getMany(
  client: PiHttpClient,
  paths: string[],
  useBatch: boolean,
): Promise<ManyResult> {
  if (paths.length === 0) return { answers: [], batchUnsupported: false };
  if (useBatch) {
    try {
      return { answers: await batched(client, paths), batchUnsupported: false };
    } catch (error) {
      if (!isMissingController(error)) throw error;
    }
  }
  const answers: BatchAnswer[] = [];
  for (const path of paths) answers.push(await single(client, path));
  return { answers, batchUnsupported: useBatch };
}

async function batched(
  client: PiHttpClient,
  paths: string[],
): Promise<BatchAnswer[]> {
  const size = envInt('PI_BATCH_SIZE', 250);
  const answers: BatchAnswer[] = [];
  for (let offset = 0; offset < paths.length; offset += size) {
    const chunk = paths.slice(offset, offset + size);
    const body = Object.fromEntries(
      chunk.map((path, index) => [
        String(index),
        { Method: 'GET', Resource: client.url(path) },
      ]),
    );
    const reply = await client.post<Record<string, BatchItem>>('batch', body);
    chunk.forEach((path, index) =>
      answers.push(batchAnswer(reply?.[String(index)], path)),
    );
  }
  return answers;
}

function batchAnswer(item: BatchItem | undefined, path: string): BatchAnswer {
  const status = typeof item?.Status === 'number' ? item.Status : 0;
  if (status === 0) {
    throw new PiRequestError(
      `PI batch answer for ${path} is missing`,
      'unavailable',
    );
  }
  return { status, content: item?.Content ?? null };
}

async function single(
  client: PiHttpClient,
  path: string,
): Promise<BatchAnswer> {
  try {
    return { status: 200, content: await client.get<unknown>(path) };
  } catch (error) {
    if (error instanceof PiRequestError && error.kind === 'not_found') {
      return { status: 404, content: null };
    }
    throw error;
  }
}

function isMissingController(error: unknown): boolean {
  return (
    error instanceof PiRequestError &&
    (error.kind === 'unsupported' || error.kind === 'not_found')
  );
}

/** Throws the failure of a non-2xx answer (a 404 passes only when `allowNotFound`). */
export function assertAnswer(
  answer: BatchAnswer,
  label: string,
  allowNotFound = false,
): void {
  if (answer.status >= 200 && answer.status < 300) return;
  if (answer.status === 404 && allowNotFound) return;
  if (answer.status === 401 || answer.status === 403) {
    const kind = answer.status === 401 ? 'auth' : 'forbidden';
    throw new PiRequestError(`${label}: ${answer.status}`, kind, answer.status);
  }
  throw new PiRequestError(
    `${label}: PI answered ${answer.status}`,
    'unavailable',
    answer.status,
  );
}
