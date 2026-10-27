import { DeclaredFigures } from '../../../../domain/events/declared-figures';
import {
  CanonicalEnvelope,
  EnvelopeAttribute,
} from '../../../envelope/canonical-envelope';

const DEFAULT_STATUS = 'REPORTED';
const DEFAULT_UOM = 't';

function find(
  attributes: readonly EnvelopeAttribute[],
  name: string,
): EnvelopeAttribute | undefined {
  return attributes.find((attribute) => attribute.name === name);
}

function numberOf(
  attributes: readonly EnvelopeAttribute[],
  name: string,
): number | null {
  const value = find(attributes, name)?.value;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function textOf(
  attributes: readonly EnvelopeAttribute[],
  name: string,
): string | null {
  const value = find(attributes, name)?.value;
  return typeof value === 'string' && value.trim() ? value : null;
}

function booleanOf(
  attributes: readonly EnvelopeAttribute[],
  name: string,
): boolean | null {
  const value = find(attributes, name)?.value;
  return typeof value === 'boolean' ? value : null;
}

function planOf(
  attributes: readonly EnvelopeAttribute[],
): DeclaredFigures['plan'] {
  const plan = {
    source: textOf(attributes, 'PlanSource'),
    planId: textOf(attributes, 'PlanId'),
    revision: numberOf(attributes, 'PlanRevision'),
    approved: booleanOf(attributes, 'PlanApproved'),
  };
  return Object.values(plan).every((value) => value === null) ? null : plan;
}

function piSourceOf(
  attributes: readonly EnvelopeAttribute[],
): DeclaredFigures['piSource'] {
  const piSource = {
    actualTag: textOf(attributes, 'PiActualTag'),
    eventFrameId: textOf(attributes, 'PiEventFrameId'),
  };
  return piSource.actualTag === null && piSource.eventFrameId === null
    ? null
    : piSource;
}

/**
 * The declared figures a PLA-feed envelope carries, or the reason the day cannot become a production
 * loss: the shortfall is required and is never negative (overproduction is not a loss).
 */
export function declaredFiguresOf(
  envelope: CanonicalEnvelope,
): { figures: DeclaredFigures } | { reason: string } {
  const attributes = envelope.values?.attributes ?? [];
  const shortfall = numberOf(attributes, 'Shortfall');
  if (shortfall === null) {
    return { reason: 'The PLA message carries no shortfall' };
  }
  if (shortfall < 0) {
    return {
      reason: 'shortfall must be ≥ 0; overproduction is not a loss',
    };
  }
  return {
    figures: {
      planned: numberOf(attributes, 'Planned'),
      actual: numberOf(attributes, 'Actual'),
      shortfall,
      uom: find(attributes, 'Shortfall')?.unit ?? DEFAULT_UOM,
      measurementQuality: textOf(attributes, 'MeasurementQuality'),
      sourceStatus: textOf(attributes, 'Status') ?? DEFAULT_STATUS,
      plan: planOf(attributes),
      piSource: piSourceOf(attributes),
    },
  };
}
