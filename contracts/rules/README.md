# Declarative admin rules — grammar contract

Plan sub-phase **3.8** (spec NFR02, §16.2 AdminPanel). A rule is **data, never code**: the browser builds a JSON
definition from pickers, the server validates it against `rule-definition.schema.json` plus the semantic checks in
`server/pro-act-backend/src/rules/grammar/rule-validator.ts`, stores it as an immutable version and evaluates it with
a pure interpreter under a step budget (`rule-interpreter.ts`). No function strings, expressions or regular
expressions are accepted anywhere.

| Path | Purpose |
|---|---|
| `rule-definition.schema.json` | JSON Schema 2020-12 of a definition; the backend keeps a checked copy (`src/rules/grammar/rule-definition.schema.ts`, drift test `rule-grammar.spec.ts`). |
| `examples/t22-long-downtime-unplanned.json` | The T22 rule: downtime lasting at least an hour is unplanned. |

Shape: `{ "when": { "all": [...], "any": [...] }, "then": [ { "set": "<field>", "value": "<v>" } | { "flag": "<code>" } ] }`.
A `when` member is a condition `{ field, op, value? }` or one nested group (two levels at most); at most 20 conditions.
Fields, their types and operators, the actions each rule kind allows and the limits are served by
`GET /api/v2/rules/schema` — the builder UI reads its pickers from there.
