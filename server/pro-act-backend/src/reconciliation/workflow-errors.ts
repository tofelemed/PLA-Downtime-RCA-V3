import {
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { WorkflowIssue } from '../domain/reconciliation/reconciliation.types';

/** 403: D06 — the submitter never approves or rejects their own submission, unless they are SuperAdmin. */
export function separationOfDuties(): ForbiddenException {
  return new ForbiddenException({
    code: 'SEPARATION_OF_DUTIES',
    message:
      'a submitted revision is approved or rejected by someone independent of it: not its submitter and, to approve, not an author of its lines or whoever reopened the period',
  });
}

export function userRequired(): ForbiddenException {
  return new ForbiddenException({
    code: 'USER_REQUIRED',
    message: 'an identified user is required',
  });
}

/** 409: the body names another revision than the period's open (or approved) one. */
export function revisionMismatch(
  expected: string,
  current: number | null,
): ConflictException {
  return new ConflictException({
    code: 'REVISION_MISMATCH',
    message: `the period's ${expected} revision is ${current ?? 'none'}`,
    details: { currentRevision: current },
  });
}

/** 409 RUN_CHANGED (§15.3): the run the editor saw is no longer current; details carry the diff. */
export function runChanged(
  details: Record<string, unknown>,
): ConflictException {
  return new ConflictException({
    code: 'RUN_CHANGED',
    message: 'the calculation run changed since it was read',
    details,
  });
}

/** 409 CONTENT_CHANGED: the content hash of the submission is not the current one. */
export function contentChanged(currentHash: string): ConflictException {
  return new ConflictException({
    code: 'CONTENT_CHANGED',
    message: 'the reconciliation changed since it was read',
    details: { contentHash: currentHash },
  });
}

/** 409 STALE_SUBMISSION (WF02, T34): inputs changed after submission or the hash differs. */
export function staleSubmission(reason: string): ConflictException {
  return new ConflictException({
    code: 'STALE_SUBMISSION',
    message: `the submission is stale: ${reason}`,
  });
}

/** 422 with the first issue's code; `details.issues` lists all of them (line index, remaining allocation). */
export function workflowIssues(
  issues: readonly WorkflowIssue[],
): UnprocessableEntityException {
  const first = issues[0];
  return new UnprocessableEntityException({
    code: first.code,
    message: first.message,
    details: { issues },
  });
}

/** 422 for one invalid line of a draft save, with its index (§15.3). */
export function lineInvalid(
  code: string,
  line: number,
  message: string,
): UnprocessableEntityException {
  return workflowIssues([
    { code, message: `line ${line}: ${message}`, sliceId: null, line },
  ]);
}
