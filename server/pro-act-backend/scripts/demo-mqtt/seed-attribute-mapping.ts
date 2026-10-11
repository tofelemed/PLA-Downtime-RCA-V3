/**
 * The attribute alias rules of the simulator's template: one versioned tenant override of
 * "Production Loss" whose rules accept both the catalog names (`ReasonCode`, ...) and the spaced
 * contract names (`Reason Code`, ...) through `FieldRule.aliases`. The API merges it field by field
 * over the catalog defaults, so the template's other default rules stay in force.
 */
import { FieldRule } from '../../src/attribute-mapping/field-rule';
import { ALIAS_FIELD_RULES, TEMPLATE_NAME } from './demo-mqtt-plan';
import {
  canonicalJson,
  createUnlessDryRun,
  Outcome,
  report,
  SeedContext,
  seedKey,
} from './seed-support';

interface OverrideView {
  id: string;
  version: number;
  fieldRules: FieldRule[];
}

interface EffectiveTemplate {
  templateName: string;
  override: OverrideView | null;
}

function rulesKey(rules: readonly FieldRule[]): string {
  const sorted = [...rules].sort((a, b) =>
    a.targetField.localeCompare(b.targetField),
  );
  return canonicalJson(sorted);
}

export async function ensureAliasRules(ctx: SeedContext): Promise<Outcome> {
  const templates = await ctx.client.get<EffectiveTemplate[]>(
    '/api/v2/attribute-mappings',
  );
  const current = templates.find(
    (template) => template.templateName === TEMPLATE_NAME,
  )?.override;
  const what = `attribute mapping override "${TEMPLATE_NAME}" (${ALIAS_FIELD_RULES.length} alias rules)`;
  if (current && rulesKey(current.fieldRules) === rulesKey(ALIAS_FIELD_RULES)) {
    return report(ctx, {
      what,
      status: 'kept',
      id: current.id,
      note: `version ${current.version}`,
    });
  }
  return createUnlessDryRun(ctx, what, async () => {
    const body = {
      templateName: TEMPLATE_NAME,
      fieldRules: ALIAS_FIELD_RULES.map((rule) => ({ ...rule })),
    };
    const { body: created } = await ctx.client.write<OverrideView>(
      'POST',
      '/api/v2/attribute-mappings',
      body,
      {
        idempotencyKey: seedKey([
          ctx.tenantId,
          'attribute-mapping',
          TEMPLATE_NAME,
          rulesKey(ALIAS_FIELD_RULES),
        ]),
      },
    );
    return { id: created.id };
  });
}
