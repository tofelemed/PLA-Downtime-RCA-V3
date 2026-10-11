import {
  EQUIPMENT_CAPTURES,
  parseTopicTemplate,
  PayloadProfileKind,
} from './payload-profile';

/**
 * Strict topic template matching (design §4.2 stage 2, OT contract §2): a template such as
 * `proact/v1/{site}/{area}/{line}/{unit}/events` matches a topic with the same number of levels, every
 * literal level equal (case-sensitive) and every `{capture}` level non-empty. Anything else is
 * `TOPIC_SHAPE`. A profile declares the captures its decoder needs; a template without them is a
 * configuration problem reported before any message is read.
 */
export type TemplateLevel = { literal: string } | { capture: string };

export interface TopicTemplate {
  template: string;
  levels: readonly TemplateLevel[];
  captures: readonly string[];
}

export type TopicMatch =
  | { ok: true; captures: Record<string, string> }
  | { ok: false; code: 'TOPIC_SHAPE'; detail: string };

/** Capture groups a profile kind needs: each inner list is "one of these". */
export const PROFILE_REQUIRED_CAPTURES: Record<
  PayloadProfileKind,
  readonly (readonly string[])[]
> = {
  interval_event_json: [EQUIPMENT_CAPTURES],
  measurement_json: [EQUIPMENT_CAPTURES, ['attribute']],
  state_json: [EQUIPMENT_CAPTURES],
  availability: [],
};

const CAPTURE = /^\{([a-z][A-Za-z0-9_]*)\}$/;

/**
 * The compiled template, or the problem with it (syntax via the step-1 parser, then the required
 * captures of `kind`).
 */
export function compileTopicTemplate(
  template: string,
  kind?: PayloadProfileKind,
): TopicTemplate | string {
  const parsed = parseTopicTemplate(template);
  if (typeof parsed === 'string') return parsed;
  const required = kind ? PROFILE_REQUIRED_CAPTURES[kind] : [];
  for (const alternatives of required) {
    if (!alternatives.some((name) => parsed.captures.includes(name))) {
      return `must capture {${alternatives.join('} or {')}} for ${kind}`;
    }
  }
  const levels: TemplateLevel[] = template.split('/').map((level) => {
    const capture = CAPTURE.exec(level);
    return capture ? { capture: capture[1] } : { literal: level };
  });
  return { template, levels, captures: parsed.captures };
}

/** Captures of a concrete topic under the template, or the shape problem (`TOPIC_SHAPE`). */
export function matchTopicTemplate(
  compiled: TopicTemplate,
  topic: string,
): TopicMatch {
  const actual = topic.split('/');
  if (actual.length !== compiled.levels.length) {
    return shapeFailure(
      `topic has ${actual.length} levels, template ${compiled.template} has ${compiled.levels.length}`,
    );
  }
  const captures: Record<string, string> = {};
  for (let index = 0; index < actual.length; index += 1) {
    const level = compiled.levels[index];
    const value = actual[index];
    if ('literal' in level) {
      if (level.literal !== value) {
        return shapeFailure(
          `level ${index + 1} is "${value}", template expects "${level.literal}"`,
        );
      }
      continue;
    }
    if (value.length === 0) {
      return shapeFailure(`level ${index + 1} ({${level.capture}}) is empty`);
    }
    captures[level.capture] = value;
  }
  return { ok: true, captures };
}

/** The contract's `{unit}` wins over the design draft's `{machine}` when a template has both. */
const EQUIPMENT_PRIORITY: readonly string[] = ['unit', 'machine'].filter(
  (name) => EQUIPMENT_CAPTURES.includes(name),
);

/** The equipment level of the captures (`unit` before `machine`), or null when neither is captured. */
export function equipmentOf(
  captures: Readonly<Record<string, string>>,
): string | null {
  for (const name of EQUIPMENT_PRIORITY) {
    const value = captures[name];
    if (value) return value;
  }
  return null;
}

function shapeFailure(detail: string): TopicMatch {
  return { ok: false, code: 'TOPIC_SHAPE', detail };
}
