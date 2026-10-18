import {
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  CaseParties,
  independenceConflict,
  RcaStatus,
  Transition,
} from '../domain/rca/case-workflow';
import { CloseBlocker } from '../domain/rca/close-gate';
import { GateIssue } from '../domain/rca/investigation-gate';
import { RequestContext } from '../common/context/request-context';
import { RCA } from '../rca/rca.entity';
import { readIds } from './rca-case-json';

export const CLOSURE_APPROVER = 'manager_approver';
const MIN_NOTE = 5;

export const CLOSE_MESSAGES: Readonly<Record<CloseBlocker, GateIssue>> = {
  ROOT_CAUSE_MISSING: {
    code: 'ROOT_CAUSE_MISSING',
    field: 'rootCause',
    message: 'write down the root cause before requesting closure',
  },
  CODED_ROOT_CAUSE_MISSING: {
    code: 'CODED_ROOT_CAUSE_MISSING',
    field: 'causes',
    message:
      'record at least one root cause linked to the cause catalogue before requesting closure',
  },
  ACTIONS_NOT_DONE: {
    code: 'ACTIONS_NOT_DONE',
    field: 'actions',
    message:
      'finish every action (done with its evidence, or cancelled with a reason)',
  },
  ACTION_EVIDENCE_MISSING: {
    code: 'ACTION_EVIDENCE_MISSING',
    field: 'actions',
    message:
      'a done action needs its objective evidence (reference or attached file)',
  },
  EFFECTIVENESS_NOT_VERIFIED: {
    code: 'EFFECTIVENESS_NOT_VERIFIED',
    field: 'actions',
    message:
      'verify effectiveness: at least one action evaluated after its window, none still pending',
  },
  RESIDUAL_RISK_MISSING: {
    code: 'RESIDUAL_RISK_MISSING',
    field: 'residualRisk',
    message: 'state how the residual risk is disposed of',
  },
};

export function invalidTransition(
  from: RcaStatus,
  to: RcaStatus,
  allowed: RcaStatus[],
) {
  return new UnprocessableEntityException({
    code: 'INVALID_TRANSITION',
    message: [
      `a ${from} case cannot move to ${to}; allowed: ${allowed.join(', ') || 'none'}`,
    ],
    fieldErrors: [{ field: 'to', message: `not allowed from ${from}` }],
  });
}

/** 422 with every blocker of a gate (code, field, message), so the screen can list them. */
export function gateBlocked(code: string, issues: readonly GateIssue[]) {
  return new UnprocessableEntityException({
    code,
    message: issues.map((issue) => issue.message),
    fieldErrors: issues.map((issue) => ({
      field: issue.field,
      message: issue.message,
    })),
    details: { blockers: issues.map((issue) => issue.code) },
  });
}

export function partiesOf(rca: RCA): CaseParties {
  return {
    createdBy: rca.createdBy ?? null,
    teamLeadId: rca.teamLeadId ?? null,
    teamMemberIds: readIds(rca.teamMemberIds),
    closureRequestedBy: rca.closureRequestedBy ?? null,
    pastInvestigators: rca.investigatorIds ?? [],
  };
}

const CONFLICT_WORDS = {
  creator: 'opened the case',
  team_lead: 'leads the investigation',
  team_member: 'is on the investigation team',
  closure_requester: 'requested the closure',
  past_investigator: 'took part in the investigation',
} as const;

/** CA1: a manager approver independent of the investigation (403 otherwise, except SuperAdmin). */
export function assertIndependentApprover(
  context: RequestContext,
  rca: RCA,
): void {
  if (context.isSuperAdmin && context.userId) return;
  if (!context.roles.includes(CLOSURE_APPROVER) && !context.isSuperAdmin) {
    throw new ForbiddenException({
      code: 'FORBIDDEN_ROLE',
      message: 'closure decisions and reopening are made by a manager approver',
    });
  }
  const conflict = context.userId
    ? independenceConflict(context.userId, partiesOf(rca))
    : null;
  if (!context.userId || conflict) {
    throw new ForbiddenException({
      code: 'SEPARATION_OF_DUTIES',
      message: `the closure is approved by someone independent of the investigation${
        conflict ? `; you ${CONFLICT_WORDS[conflict]}` : ''
      }`,
    });
  }
}

export function assertNote(
  transition: Transition,
  note: string | undefined,
): string | null {
  const text = note?.trim() ?? '';
  if (!transition.gates.includes('note')) return text || null;
  if (text.length < MIN_NOTE) {
    throw gateBlocked('NOTE_REQUIRED', [
      {
        code: 'NOTE_REQUIRED',
        field: 'note',
        message: `say why (at least ${MIN_NOTE} characters)`,
      },
    ]);
  }
  return text;
}
