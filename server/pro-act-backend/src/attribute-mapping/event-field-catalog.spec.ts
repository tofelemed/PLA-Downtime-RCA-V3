import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  CODING_FIELDS,
  SOURCE_ATTRIBUTE_FACTS,
  SOURCE_COLUMN_FIELDS,
  SOURCE_FIELDS,
} from '../production-event/revisions/event-facts';
import { ruleErrors } from './attribute-rules';
import { EVENT_FIELD_CATALOG } from './event-field-catalog';

/** Published copy shared with the frontend mapping UI (plans/phase-1/README.md "Shared artifacts"). */
const CONTRACT = resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'contracts',
  'event-field-catalog.json',
);

/** Source fields that come from the frame itself or the mapping, never from an attribute. */
const NOT_MAPPABLE = new Set([
  'startTime',
  'endTime',
  'eventType',
  'assetId',
  'planId',
  'mappingDiagnostics',
]);

/** Plan 1.3 step 4 (I10): backend validation, the event fact sets and the UI catalog cannot drift. */
describe('event field catalog', () => {
  it('matches contracts/event-field-catalog.json', () => {
    const published: unknown = JSON.parse(readFileSync(CONTRACT, 'utf8'));
    expect(published).toEqual(EVENT_FIELD_CATALOG);
  });

  it('lists exactly the mappable source fields of an event', () => {
    const catalog = EVENT_FIELD_CATALOG.fields
      .map((field) => field.name)
      .sort();
    const mappable = SOURCE_FIELDS.filter(
      (field) => !NOT_MAPPABLE.has(field),
    ).sort();
    expect(catalog).toEqual(mappable);
  });

  it('stores each field where the revision layer expects it', () => {
    for (const field of EVENT_FIELD_CATALOG.fields) {
      const expected =
        field.storedAs === 'column'
          ? SOURCE_COLUMN_FIELDS
          : SOURCE_ATTRIBUTE_FACTS;
      expect([field.name, expected]).toEqual([
        field.name,
        expect.arrayContaining([field.name]),
      ]);
    }
  });

  it('resolves code fields to coding fields only', () => {
    const resolved = EVENT_FIELD_CATALOG.fields
      .map((field) => field.resolvesTo)
      .filter((target): target is NonNullable<typeof target> =>
        Boolean(target),
      );
    expect(resolved).toEqual(['reasonCodeId', 'impactCodeId', 'oeeCodeId']);
    for (const target of resolved) {
      expect(CODING_FIELDS as readonly string[]).toContain(target);
    }
  });

  it.each(
    EVENT_FIELD_CATALOG.templates.map((template) => [template.name, template]),
  )(
    'default rules of %s pass the same validation as tenant rules',
    (_name, template) => {
      expect(ruleErrors(template.name, template.defaultRules)).toEqual([]);
    },
  );
});
