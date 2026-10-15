# HDPE application dependency audit

The production dependency findings remain **unresolved: backend 4 moderate, 3 high and 1 critical; frontend 4 moderate**. These are npm's package-level findings, including affected parent packages: 12 entries across two separately installed dependency trees, not 12 confirmed exploitable application endpoints. The backend returns 21 advisory records across three chains; the frontend returns three records across two chains. No packages, lockfiles or application code were changed during this review.

## Evidence and scope

- Audit captured on **2026-10-15 at 18:23 UTC** using Node 24.11.1 / npm 11.6.2: `test-results/hdpe-audit/backend-dependency-audit.json`. Exit code 1 means vulnerabilities were found; the saved response is complete JSON, not a network failure.
- Installed chain evidence: `test-results/hdpe-audit/backend-dependency-chains.json`.
- Read-only npm registry metadata: `backend-dependency-fix-metadata.json`, `backend-dependency-fix-alternatives.json` and `backend-lodash-fix-version.json` in the same evidence directory.
- Reviewed `server/pro-act-backend/package-lock.json` SHA-256: `CFFA59F4D2B79B458E2A51304478314A3FB8194BAB1A534EC0315D927BF5D81F`. Package manifest and lockfile had no Git diff from this audit.

This is a production npm dependency scan of both projects plus a focused source review. It does not cover development dependencies, container operating-system packages, arbitrary dynamic loading or a penetration test. No exploit payloads were executed. The findings describe installed versions; app-specific exposure below is an inference from inspected call sites.

## Backend installed packages

| Package | Installed version | npm severity | Installed chain |
|---|---:|---|---|
| `tar` | 6.2.1 | Critical | `bcrypt@5.1.1` → `@mapbox/node-pre-gyp@1.0.11` → `tar` |
| `@mapbox/node-pre-gyp` | 1.0.11 | High | Parent affected through `tar` |
| `js-yaml` | 4.1.0 | High | `@nestjs/swagger@8.1.1` → `js-yaml` |
| `lodash` | 4.17.21 | High | `@nestjs/swagger@8.1.1` → `lodash` |
| `@nestjs/swagger` | 8.1.1 | Moderate | Parent affected through its YAML/Lodash dependencies |
| `sprintf-js` | 1.1.3 | Moderate | `mssql@11.0.2` → `tedious@18.6.2` → nested `sprintf-js` |
| `tedious` | 18.6.2 | Moderate | Parent affected through `sprintf-js` |
| `mssql` | 11.0.2 | Moderate | Direct dependency; also resolved for TypeORM's SQL Server driver |

## Preconditions and application exposure

**Archive extraction:** the critical tar advisory requires processing an attacker-controlled archive and permits resource exhaustion during extraction. Other records concern archive path handling or parser failures; the latest selected-member recursion advisory specifically requires a nonempty member-selection list. Maintainer fixes are 7.5.19 for the critical finding and 7.5.21 for the latter recursion issue. [Critical advisory](https://github.com/isaacs/node-tar/security/advisories/GHSA-23hp-3jrh-7fpw), [selected-member advisory](https://github.com/isaacs/node-tar/security/advisories/GHSA-r292-9mhp-454m).

The inspected application imports `bcryptjs` in `src/auth/auth.service.ts`, `src/users/users.service.ts` and its seed/bootstrap scripts. No application TypeScript import of native `bcrypt` or `tar` was found. The installed native-binary installer does use `tar.extract` on downloaded or local archives (`node_modules/@mapbox/node-pre-gyp/lib/install.js:78,100,129`). Its extraction call has no member-selection list, so the specific recursion trigger was not found there. The critical extraction risk still matters to dependency installation/builds if that archive source is attacker-controlled or compromised. Docker runs `npm ci` during its build and retains this production dependency in the runtime image. No HTTP archive-extraction path was identified in this focused review.

**Swagger YAML/Lodash:** the YAML CPU findings require loading crafted YAML; the most recent maintainer fix for the installed 4.x line is 4.3.2. Lodash's template finding requires attacker-controlled `options.imports` key names, or a separate prototype-pollution vector feeding template compilation. Its `omit`/`unset` findings require crafted property paths. Current maintainer guidance fixes the template and bypass issues in Lodash **4.18.1**. [YAML advisory](https://github.com/nodeca/js-yaml/security/advisories/GHSA-2883-xcg3-v3hh), [template advisory](https://github.com/lodash/lodash/security/advisories/GHSA-r5fr-rjxr-66jc), [path-bypass advisory](https://github.com/lodash/lodash/security/advisories/GHSA-f23m-r3pf-42rh).

`src/main.ts:61-68` builds OpenAPI from application metadata. Installed Swagger uses `jsyaml.dump` for generated output (`node_modules/@nestjs/swagger/dist/swagger-module.js:147`); no YAML `load` call was found in that package. Swagger does call Lodash `omit`, with paths from its implementation or developer-provided DTO metadata. No `template`/`unset` call or request-controlled omission path was identified in the inspected Swagger code. This reduces the observed exposure but does not remove the vulnerable installed packages.

**SQL Server formatting:** the sprintf issue requires an attacker to control the format string's precision specifier, which can cause a `RangeError`. The current advisory lists no patched sprintf-js version. [Original disclosure](https://github.com/alexei/sprintf.js/issues/237), [advisory status](https://github.com/advisories/GHSA-hp3w-g68c-fv3c).

The app's configured database source is PostgreSQL (`src/database/data-source.ts:21`). The search found SQL Server use in legacy maintenance scripts, including `scripts/ensure-roles-tasks.ts`; no direct mssql import was found under application `src/`. Installed tedious uses constant format strings in `login7-payload.js`, `metadata-parser.js`, `packet.js`, `prelogin-payload.js` and `value-parser.js`. Attacker-controlled format precision was not identified in those calls. This review did not execute or validate the legacy SQL Server scripts.

## Remediation options requiring separate implementation and verification

| Chain | Narrower option | Upgrade implications |
|---|---|---|
| Native bcrypt → tar | Confirm native `bcrypt` is unnecessary and remove that direct dependency, retaining the already-used `bcryptjs`. | If native bcrypt is needed, published `bcrypt@6.0.0` replaces node-pre-gyp with node-gyp-build; this is a major bcrypt upgrade. Authentication/password compatibility and the container build need checks. |
| Existing node-pre-gyp → tar | No published 1.x node-pre-gyp release checked advances beyond 1.0.11 / tar `^6.1.11`. | `tar@7.5.21` is outside the present `^6.1.11` range. `@mapbox/node-pre-gyp@2.0.3` accepts tar `^7.4.0`, but is outside bcrypt's `^1.0.11` range. Forcing either with an override is a major transitive change, not an established compatible patch. npm's generic `fixAvailable: true` does not prove otherwise. |
| Swagger → YAML/Lodash | Candidate scoped overrides to `js-yaml@4.3.2` and `lodash@4.18.1` stay within each child's current major version. | Swagger 8.1.1 pins both children exactly, so this needs an intentional override/lock change and OpenAPI, serialization and build regression checks. Same-major versions are compatibility candidates, not tested fixes in this audit. |
| Swagger parent upgrade | npm suggests `@nestjs/swagger@12.0.2`, which removes Lodash and uses js-yaml 5.4.2. | Its published peer requirements are Nest common/core `^12.0.0`, while this app is Nest 11. This is a coordinated framework upgrade. Swagger 11.2.6 supports Nest 11 but still pins vulnerable `lodash@4.17.23` / `js-yaml@4.1.1`, so it does not resolve these findings on its own. |
| mssql → tedious → sprintf-js | If the legacy SQL Server maintenance capability is no longer required, review removal of mssql and its scripts. | Otherwise npm proposes `mssql@12.7.9` (major upgrade), whose range permits `tedious@20.3.6`; that release has no sprintf-js dependency and requires Node ≥22. The Dockerfile uses Node 24. Pin/check the actual resolved tree and test SQL Server behavior; a version-range declaration alone does not verify the replacement tree. |

The raw audit and maintainer advisories are not perfectly synchronized: the raw Lodash template range ends at 4.17.23, while the maintainer advisory now specifies versions below 4.18.1. The maintainer's newer fixed version was verified as published with `npm view lodash@4.18.1 version`. Use that version floor rather than inferring safety from the older audit range.

After an approved dependency change, rerun the production audit, inspect the resolved tree, rebuild the Docker image and run the affected auth/OpenAPI/SQL Server checks. No automatic `npm audit fix`, forced upgrade, package installation or lockfile rewrite was performed here.

## Backend advisory identifiers in the captured audit

The complete titles, affected ranges, severities and URLs are preserved in the raw JSON. These links identify the 21 returned records; parent package entries do not add independent advisories.

| Package | Advisory URLs |
|---|---|
| tar | [34x7-hfp2-rc4v](https://github.com/advisories/GHSA-34x7-hfp2-rc4v), [8qq5-rm4j-mr97](https://github.com/advisories/GHSA-8qq5-rm4j-mr97), [83g3-92jg-28cx](https://github.com/advisories/GHSA-83g3-92jg-28cx), [qffp-2rhf-9h96](https://github.com/advisories/GHSA-qffp-2rhf-9h96), [9ppj-qmqm-q256](https://github.com/advisories/GHSA-9ppj-qmqm-q256), [r6q2-hw4h-h46w](https://github.com/advisories/GHSA-r6q2-hw4h-h46w), [vmf3-w455-68vh](https://github.com/advisories/GHSA-vmf3-w455-68vh), [w8wr-v893-vjvp](https://github.com/advisories/GHSA-w8wr-v893-vjvp), [23hp-3jrh-7fpw](https://github.com/advisories/GHSA-23hp-3jrh-7fpw), [8x88-c5mf-7j5w](https://github.com/advisories/GHSA-8x88-c5mf-7j5w), [gvwx-54wh-qm9j](https://github.com/advisories/GHSA-gvwx-54wh-qm9j), [r292-9mhp-454m](https://github.com/advisories/GHSA-r292-9mhp-454m) |
| js-yaml | [mh29-5h37-fv8m](https://github.com/advisories/GHSA-mh29-5h37-fv8m), [h67p-54hq-rp68](https://github.com/advisories/GHSA-h67p-54hq-rp68), [52cp-r559-cp3m](https://github.com/advisories/GHSA-52cp-r559-cp3m), [5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj), [2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh) |
| lodash | [r5fr-rjxr-66jc](https://github.com/advisories/GHSA-r5fr-rjxr-66jc), [f23m-r3pf-42rh](https://github.com/advisories/GHSA-f23m-r3pf-42rh), [xxjr-mmjv-4gpg](https://github.com/advisories/GHSA-xxjr-mmjv-4gpg) |
| sprintf-js | [hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) |

## Frontend audit and exposure

The root project's scan was captured on **2026-10-15 at 18:37 UTC**, using the same Node/npm versions. Raw evidence is `test-results/hdpe-audit/frontend-dependency-audit.json`; installed versions are in `frontend-dependency-chains.json`. Registry checks are in `frontend-dependency-fix-metadata.json` and `swagger-latest-11-metadata.json`. Root `package-lock.json` SHA-256: `30D8955E1DF70EB5A7F8D38F31562E3850052FEC43DBFE98AE55BA9C1E774030`. No root package or lockfile Git diff was introduced.

| Package | Installed version | npm severity | Chain / advisory |
|---|---:|---|---|
| `js-yaml` | 5.3.0 | Moderate | `@nestjs/swagger@11.4.7` → js-yaml; [GHSA-r3ph-w7gj-g6xm](https://github.com/nodeca/js-yaml/security/advisories/GHSA-r3ph-w7gj-g6xm) |
| `@nestjs/swagger` | 11.4.7 | Moderate | Direct root dependency affected through js-yaml |
| `react-router` | 6.30.6 | Moderate | `react-router-dom@6.30.6` → react-router; [external redirect](https://github.com/remix-run/react-router/security/advisories/GHSA-wrjc-x8rr-h8h6), [SSR hydration](https://github.com/remix-run/react-router/security/advisories/GHSA-337j-9hxr-rhxg) |
| `react-router-dom` | 6.30.6 | Moderate | Direct dependency affected through react-router |

The 5.x YAML advisory requires loading attacker-controlled YAML with merge keys enabled; the maintainer identifies 5.4.1 as fixed. The focused search found no `@nestjs/swagger` or `js-yaml` imports under frontend `src/` or root `scripts/`. This appears to be an unnecessary frontend dependency, but bundle/runtime removal was not tested. Candidate remedies are removal after checking its purpose, or a scoped js-yaml 5.4.1+ override followed by a build. Swagger 11.4.7 pins 5.3.0 exactly and is the latest published 11.x version returned by the registry check, so the audit's `fixAvailable: true` is not evidence of an available same-range parent patch. [Maintainer YAML advisory](https://github.com/nodeca/js-yaml/security/advisories/GHSA-r3ph-w7gj-g6xm).

React Router's redirect finding requires attacker-supplied paths reaching navigation mechanisms. The focused source review traced `navigate`, `Link`/`NavLink`/`Navigate`, back-link wrappers and URL-derived destinations under `src/`. Menus use fixed internal routes; record links use fixed route prefixes; legacy RCA query redirects encode their identifiers (`case-filters.ts`, `rca-knowledge-page.tsx`). Login does not consume a `returnTo`, `redirectTo`, `returnUrl` or `nextUrl` destination. No remotely supplied arbitrary destination was identified. This is a source review, not an exploit test. [Redirect advisory](https://github.com/remix-run/react-router/security/advisories/GHSA-wrjc-x8rr-h8h6).

One concrete hardening gap remains: `src/features/event-hub/hooks/use-back-target.ts` accepts any string in `history.state.listSearch` and returns it as a navigation destination. All current writers found in Event Hub, its event table/current-stops panel, and the downtime timeline construct it from `location.pathname + location.search`; no query-string-to-history-state writer was found. Therefore a direct external URL does not establish an exploit through this path, but a future caller or same-origin history-state manipulation could supply an unchecked target. Restrict this back target to known internal event/downtime routes. The package advisory remains open regardless of this presently limited input path.

The separate hydration advisory explicitly excludes Declarative Mode: this app mounts with `createRoot` (`src/main.tsx`) and `BrowserRouter` (`src/App.tsx`), and no SSR/hydration entry point was found. That advisory's stated SSR precondition is absent from the inspected frontend architecture. [SSR scope](https://github.com/remix-run/react-router/security/advisories/GHSA-337j-9hxr-rhxg).

The maintainer marks React Router 7.18.0+ as fixed for both findings; npm proposes `react-router-dom@7.18.4`, outside this project's `^6.26.2` range. Published metadata requires React/ReactDOM ≥18 and Node ≥20, which the project's React 18 / Node 24 setup meets. This is still a major routing upgrade requiring navigation, guarded-route, history and deep-link regression checks; it was not applied or tested here. For the current version, keep navigation destinations restricted to known local routes rather than accepting arbitrary return URLs. The dependency findings stay open until remediation and a new audit are completed.

## Reproduction

Run from `server/pro-act-backend`; these commands inspect dependencies without modifying them:

```powershell
npm audit --omit=dev --json > ../../test-results/hdpe-audit/backend-dependency-audit.json
npm ls --omit=dev @mapbox/node-pre-gyp @nestjs/swagger js-yaml lodash mssql sprintf-js tar tedious bcrypt --all --json > ../../test-results/hdpe-audit/backend-dependency-chains.json
npm view @nestjs/swagger@12.0.2 version dependencies peerDependencies engines --json
```

For the frontend, run from the repository root:

```powershell
npm audit --omit=dev --json > test-results/hdpe-audit/frontend-dependency-audit.json
npm ls --omit=dev @nestjs/swagger js-yaml react-router react-router-dom --all --json > test-results/hdpe-audit/frontend-dependency-chains.json
```

Keep the audit exit status separate from test-suite status: functional HDPE tests passing does not resolve these dependency findings.
