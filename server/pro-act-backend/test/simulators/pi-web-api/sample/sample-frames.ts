import { OPEN_SENTINEL, SimFrame } from '../sim-model';
import {
  crewOf,
  LossScenario,
  NOMINAL_RATE_TPH,
  SAMPLE_DATABASE,
  SampleElement,
  shiftOf,
} from './sample-plant';

/**
 * Event frame WebIds shaped like PI's (`F1Fm…`), derived from the kind and start minute so a restarted
 * sample server serves the same history under the same ids.
 */
export function frameWebId(kind: 'L' | 'O' | 'P', start: Date): string {
  const minute = Math.floor(start.getTime() / 60_000)
    .toString(36)
    .toUpperCase();
  return `F1FmMarun${kind}${minute}`;
}

function stamp(at: Date): string {
  return at.toISOString().slice(0, 16).replace('T', ' ');
}

function elementRef(
  element: SampleElement,
): SimFrame['PrimaryReferencedElement'] {
  return { WebId: element.webId, Path: element.path };
}

const unitName = (element: SampleElement) =>
  element.path.split('\\').filter(Boolean).pop() ?? element.key;

/**
 * A `Production Loss` frame. While `end` is null the frame is open (PI sentinel end time) and carries
 * only the reason and context; closing it adds `Duration` (minutes) and the lost `Quantity` (t).
 */
export function lossFrame(input: {
  scenario: LossScenario;
  element: SampleElement;
  start: Date;
  end: Date | null;
}): SimFrame {
  const { scenario, start, end } = input;
  const attributes: Record<string, unknown> = {
    ReasonCode: {
      Name: scenario.reason,
      Value: scenario.state,
      IsSystem: false,
    },
    Description: scenario.description,
    LossCategory: scenario.lossCategory,
    Shift: shiftOf(start),
    Crew: crewOf(start),
    OperatorName: `Operator ${shiftOf(start)}`,
  };
  if (end) {
    const minutes = (end.getTime() - start.getTime()) / 60_000;
    attributes.Duration = {
      Value: round(minutes, 2),
      UnitsAbbreviation: 'min',
    };
    attributes.Quantity = {
      Value: round((NOMINAL_RATE_TPH * scenario.lossShare * minutes) / 60, 3),
      UnitsAbbreviation: 't',
    };
  }
  return {
    WebId: frameWebId(input.element.key === 'pelletizer' ? 'P' : 'L', start),
    Name: `${unitName(input.element)} loss ${stamp(start)}`,
    TemplateName: 'Production Loss',
    StartTime: start.toISOString(),
    EndTime: end ? end.toISOString() : OPEN_SENTINEL,
    databaseWebId: SAMPLE_DATABASE.WebId,
    PrimaryReferencedElement: elementRef(input.element),
    attributes,
  };
}

/** A closed `Production Output` frame for one shift with good and scrap tonnage. */
export function outputFrame(input: {
  element: SampleElement;
  start: Date;
  end: Date;
  goodTonnes: number;
  scrapTonnes: number;
}): SimFrame {
  return {
    WebId: frameWebId('O', input.start),
    Name: `${unitName(input.element)} output shift ${shiftOf(input.start)} ${stamp(input.start)}`,
    TemplateName: 'Production Output',
    StartTime: input.start.toISOString(),
    EndTime: input.end.toISOString(),
    databaseWebId: SAMPLE_DATABASE.WebId,
    PrimaryReferencedElement: elementRef(input.element),
    attributes: {
      GoodQty: { Value: round(input.goodTonnes, 3), UnitsAbbreviation: 't' },
      ScrapQty: { Value: round(input.scrapTonnes, 3), UnitsAbbreviation: 't' },
      Shift: shiftOf(input.start),
      Crew: crewOf(input.start),
    },
  };
}

export function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
