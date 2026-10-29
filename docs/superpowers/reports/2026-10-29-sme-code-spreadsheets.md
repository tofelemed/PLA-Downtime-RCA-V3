# SME code spreadsheets: what they are, how they compare with standards, and where they fit in Traverse Forge

Date: 29 Oct 2026. Source: the six files in `xlsx from sme/` (read in full with openpyxl, not only the truncated dump).
Compared with the code and the HDPE-TRAIN tenant data in `proact` (read-only queries). No repo file was changed apart from this report.

**Summary.** All six files are **asset-management (CMMS/EAM) code lists**: asset classes, criticality, maintenance action codes, cause codes, a sample functional-location list, and a 35k-row problem/failure catalogue. **None of them is a downtime reason list.** None carries a planned/unplanned/external class or an OEE/ISO 22400 component, and none covers rate, quality, planned or external losses. They are useful for the **failure dictionary** (ISO 14224 coding of *unplanned equipment stops*) and the **RCA cause library**. They do not replace the downtime reason code library or PLA reason coding.

---

## 1. The six spreadsheets

### 1.1 AM-Action-Codes.xlsx: maintenance activity codes
- **What it is.** The list of what maintenance *did* to an item ("action taken" on a work order). Most definitions are taken almost word for word from the ISO 14224 maintenance-activity table.
- **Structure.** One sheet, 11 codes. Columns: `Code | Definition | Example`. Flat, no hierarchy. The codes are words, not short codes: Replace, Repair, Adjust, Refit, Troubleshoot, Overhaul, Service, Construct, Test, Inspection, Modify.
- **Product home.** None today. The nearest field is `work_order_operations.operation_kind` (`diagnosis|repair|test|other`, `server/pro-act-backend/src/reliability/entities/work-order-operation.entity.ts`). That field sorts repair *time* into active and non-active repair (SME D10). It is not an ISO activity code. Production events have no "maintenance activity" field.

### 1.2 AM-Asset-Classes.xlsx: equipment class list
- **What it is.** A flat list of 873 equipment class names from a generic, multi-industry EAM template. It covers oil & gas, refining, power, wastewater, drilling, machining and buildings.
- **Structure.** One column, 873 unique names, with no codes and no hierarchy. The names are exactly the same 873 classes as the `Asset Class` column of the hierarchical file. The hierarchical file adds `Noun` (388 distinct) and `Modifier`, so the noun–modifier hierarchy lives there, not in this file.
- **Product home.** `failure_dictionary_entries` rows with `entry_kind = 'equipment_class'` (code ≤ 50 chars, `asset_types` jsonb linking to `assets.asset_type`). HDPE-TRAIN has one class today (`EXTRUDER`).

### 1.3 AM-Asset-Criticality.xlsx: asset criticality scale
- **What it is.** A 10-level criticality code. The level comes from the asset's *role* and whether it has a spare:
  - 10 Safety Protection
  - 9 Environmental Protection
  - 8 Facility Utility
  - 7 Process Non-Spared
  - 6 Process Spared
  - 5 Support Non-Spared
  - 4 Support Spared
  - 3 Site Facilities
  - 2 Administrative Facilities
  - 1 Grounds
- **Structure.** `Code | Definition` (10 rows), then 10 rows of free text with longer definitions. The free text has encoding damage ("�" where a dash belongs).
- **Product home.** `assets.criticality` (varchar 50). The v2 DTO restricts it to `ASSET_CRITICALITIES = ['High','Medium','Low']` (`server/pro-act-backend/src/v2/assets/asset-v2.dto.ts:17`). Two features use it: the bad-actor report and the RCA policy rule D17 (critical assets get production thresholds × factor). The 10-level scale does not fit the field without a mapping.

### 1.4 AM-Cause-Codes.xlsx: two cause lists on one sheet
- **What it is.** Two separate cause lists, each with its own header row:
  - **List A (5 codes):** DSN Design, INST Installation, OPR Operation, MNT Maintenance, EF External Factor. These follow the ISO 14224 failure-cause *categories*.
  - **List B (8 codes):** 3RDPARTY, ENVIRO, MACHINE, MAN, MATERIAL, MEASURE, METHOD, UTILITY. This is the Ishikawa 6M set plus Utility and Third party.
- **Structure.** `Code | Definition`. Both lists are flat with one level. The "definitions" are only the expanded names.
- **Product home.**
  - List A belongs in `failure_dictionary_entries` (`failure_cause`, using the `category` column).
  - List B belongs in the **RCA cause library** `rca_cause_codes`. Its roots already follow the same idea: HDPE-TRAIN categories are Equipment, Material, Method, Environment, Personnel, Process.

### 1.5 AM-Position-Sample.xlsx: functional-location sample
- **What it is.** 26 sample *positions* (functional locations / tag positions), from a **gas/refinery plant, not HDPE**: make-up compressors, debutanizer, absorber, deaerator, PSVs with tags such as `30-E-5A`, `30-V-5`.
- **Structure.** `Position # | Position Description | Criticality`. Numbers run 100001–100026. Descriptions use the noun-first form "NOUN, MODIFIER, qualifier, train" (e.g. `PUMP, BOILER FEED WATER, A`). Criticality uses the 1.3 scale.
- **Product home.** `assets` (code = position number, name = description, `criticality`, `asset_type` = class). The product has no position-vs-installed-equipment split: an asset row stands for both.

### 1.6 Asset-Class-Problem-Failure-Codes-Hierarchical-Format.xlsx: problem → failure catalogue
- **What it is.** The main content: for each asset class, a list of *problems* (symptoms) and, under each problem, possible *failures* (mostly physical causes).
- **Structure.**
  - 35,331 rows and 7 columns: `Asset Class | Noun | Modifier | Problem Code | Problem description | Failure Code | Failure description`.
  - Levels: Noun (388) → Modifier → Asset Class (873) → Problem (10,968 codes) → Failure (33,704 codes).
  - Codes are `<PREFIX>-P-nn` and `<PREFIX>-F-nn` (e.g. `EXR-P-01`, `PF-F-12`). Each class has its own prefix and all 873 prefixes are unique.
  - Classes range from 1 problem (Wastewater Cannon) to 73 (Chemical Injection Metering Valve). The median is 32 rows per class.
- **Product home.** `failure_dictionary_entries`:
  - Problem → `failure_mode` (tied to the class).
  - Failure → the content is a mix of maintainable item, mechanism and cause. It does not fit the product's single-level, plant-wide `failure_cause` / `failure_mechanism` lists (see §2.6 and §5).

---

## 2. Standards check

Reference points:
- **ISO 14224:2016**: equipment taxonomy (levels 1–9); Annex A equipment classes; Annex B failure modes per equipment class, failure mechanisms, failure causes, detection methods and maintenance activities.
- **ISO 22400-2**: the time model (planned busy time, planned/unplanned downtime, actual production time, etc.) and KPI formulas. ISO 22400-2 does **not** define reason code lists.
- **Downtime class convention**: planned / unplanned / external, as used by the product (`default_schedule_class`).

### 2.1 AM-Action-Codes vs the ISO 14224 maintenance-activity list
As I know the ISO 14224 Annex B activity list, it contains: Replace, Repair, Modify, Adjust, Refit, Check, Service, Test, Inspection, Overhaul, Combination, Other.

| SME code | Verdict |
|---|---|
| Replace, Repair, Adjust, Refit, Modify, Overhaul, Test, Inspection | **Standard.** Names and definitions match ISO 14224 almost word for word. |
| Service | **Standard name, weak definition** ("Service task"). ISO describes periodic service, normally with no dismantling. The example list also includes "adjustments, calibrations", which overlap with **Adjust**. |
| Troubleshoot | **Deviates in name only.** Its definition ("cause investigated, no maintenance action performed, or action deferred") is the ISO definition of **Check**. Rename it to Check, or keep Troubleshoot as an alias. |
| Construct | **Not in the ISO 14224 list as I know it.** Building crates and scaffolding is not a maintenance activity on the failed item; ISO would put it under Other. The example has a typo ("shipping creates" → crates). |
| *(missing)* | **Combination** (several activities, none dominant) and **Other** are both in ISO. Without them, mixed work orders get forced into one code. |
| Inspection vs Test vs Service | Overlap: monthly calibration appears under Service, but calibration is an Adjust example. Needs one rule: "calibration = Adjust". |

The codes are full words, not short codes (ISO-style short codes would be RPL, RPR, MOD, ADJ, CMB, CHK, SVC, TST, INS, OVH, OTH). That is acceptable if the CMMS uses the same words.

### 2.2 AM-Asset-Classes vs the ISO 14224 equipment taxonomy
- **Standard in concept, not in granularity.** ISO 14224 Annex A defines a small set of equipment *classes* (compressors, pumps, gas turbines, electric motors, heat exchangers, vessels, valves, etc., each with a short class code). Each class has *types* (e.g. Pump → centrifugal, reciprocating, rotary). The SME list mixes three taxonomy levels in one flat list:
  - **ISO class level:** Pump, Compressor, Heat Exchanger, Vessel, Turbine Steam, Generator - Electric, Valve Check.
  - **ISO type level:** `Pump - Centrifugal`, `Compressor, Reciprocating`, `Compressor, Centrifugal`, `Valve Gate/Globe/Ball/Butterfly`.
  - **OEM model level, not an ISO concept:** `6B / 6F / 7E / 7F / 7HA / 9E / 9F / GT13E2 Gas Turbine`, `Turbine Gas - GE MS-7001`.
- **Duplicates and synonyms:**
  - Word-order duplicates: `Pressure Vessel` = `Vessel Pressure`; `Tower Vessel` = `Vessel - Tower`.
  - Near-synonyms: `Heat Exchanger` vs `Shell and Tube Heat Exchanger`; `Tank - Storage` vs `Vertical Storage Tank` vs `Aboveground Storage Tank`; `Valve Check` vs `In Line Check Valve` vs `Lift Check Valve` vs `Ball Check Valve`.
  - Some "classes" are only process-service names for a valve: `Sludge Valve`, `Primary Effluent Valve`, `Wash Water Return Valve`.
- **Copied content.** 148 classes fall into 43 groups whose problem/failure content is word-for-word identical. For example, 18 tank classes share one catalogue, 6 GE frame turbines share one, and 5 wastewater "valves" share one. These classes add names, not information.
- **No class codes.** Names only. The ISO short class codes are absent.
- **Coverage for an HDPE plant is thin:**
  - Present: `Extruder`, `Gear Box`, `Gear Pump`, `Compressor, Reciprocating/Centrifugal`, `Pump - Centrifugal`, `Blower`, `Silo`, `Dryer`, `Feeder, Gravimetric`, `Granulator`, `Palletizer`, `Motor Electric - AC Induction`, `VFD`.
  - Missing: a polymerisation reactor (the reactors listed are reforming, isomerisation, fixed-bed and wastewater types), an underwater/strand pelletiser (only `Sludge Pelletizer`), screen changer, melt pump, cyclone, rotary valve/airlock, flare.

### 2.3 AM-Asset-Criticality vs standard practice
- ISO 14224 records criticality as an equipment attribute but does not prescribe a 10-level scale. Common practice ranks criticality by **consequence of failure**: HSE, production, cost, sometimes combined with likelihood. NORSOK Z-008 is a typical reference.
- The SME scale is a **functional category ranking**: what the asset is for, and whether it has a spare. It is not a consequence assessment. Specific problems:
  - It assumes every safety asset outranks every process asset. Under consequence-based ranking, a non-spared reactor feed compressor would normally rank as high as or higher than an eyewash station.
  - "Spared vs non-spared" is applied only to process and support equipment, not to utilities or safety equipment.
  - Codes 1–3 (grounds, admin, site facilities) are building/facility assets that will not appear on a production line.
- **The SME's own sample contradicts the scale.** In AM-Position-Sample:
  - Spared pairs (`PUMP, BOILER FEED WATER, A/B`, `COMPRESSOR, MAKE UP FIRST STAGE, A/B`, `EXCHANGER … A/B`) are coded **9 = Environmental Protection**. By the scale's own definitions they should be **6 = Process Spared**.
  - Vessels (`VESSEL, DEBUTANIZER TOWER`) are coded **10 = Safety Protection**, but they are process equipment (7).
  - PSVs at 10 are consistent with the scale.

### 2.4 AM-Cause-Codes vs ISO 14224 failure causes and the RCA convention
**List A against the ISO 14224 failure-cause categories.** As I know them, the ISO categories are: design-related, fabrication/installation-related, operation/maintenance-related (off-design service, operating error, maintenance error, expected wear and tear), management-related (documentation, management error), and miscellaneous (no cause found, common cause, combined causes, other unit/cascading, other, unknown).

| SME | ISO 14224 | Verdict |
|---|---|---|
| DSN Design | Design-related | Standard |
| INST Installation | Fabrication/installation-related | Standard, but narrower: manufacturing/fabrication defects have no code |
| OPR Operation, MNT Maintenance | Operation/maintenance-related, split | Acceptable split. Note that ISO counts "expected wear and tear" here; the SME list has no home for normal wear. |
| EF External Factor | No ISO category of that name | Closest ISO entry is "other unit / cascading failure" or Miscellaneous. Ambiguous: utility loss, weather and third-party damage would all land here. |
| *(missing)* | Management-related | Missing (procedures, documentation, management error) |
| *(missing)* | Miscellaneous: no cause found / unknown | Missing. The product already has `CAUSE_PENDING` for "investigation pending". |

**List B against the Ishikawa 6M convention:**
- MAN, MACHINE, MATERIAL, METHOD, MEASURE (Measurement) and ENVIRO (Environment / "Mother Nature") are the standard 6M set.
- UTILITY and 3RDPARTY are additions. They are sensible for a process plant, but they overlap with ENVIRO and with List A's `EF`.
- Overlap between the two lists:
  - OPR/MNT ≈ MAN + METHOD
  - DSN ≈ MACHINE + METHOD
  - EF ≈ ENVIRO + UTILITY + 3RDPARTY

  The two lists are alternative top levels, not two levels of one tree. List A is how ISO 14224 classifies *failure causes*. List B is how RCA *fishbone* categories are drawn.

### 2.5 AM-Position-Sample vs the ISO 14224 taxonomy
- Positions are equipment-unit / tag-level items (taxonomy level 6). The noun-first descriptions and train suffixes (A/B) are good practice.
- Missing for a usable import: plant/unit/system parents (taxonomy levels 3–5), an equipment class per row, and a link to an installed equipment serial number.
- Some descriptions embed the tag number (`PSV, … 30-E-5A`) instead of holding it in a separate tag column.

### 2.6 Hierarchical problem/failure file vs ISO 14224 failure modes, mechanisms and causes
ISO 14224 records a failure in separate fields:
- **failure mode** per equipment class, e.g. FTS fail to start, NOI noise, VIB vibration, OHE overheating, ELP/ELU external leakage, INL internal leakage, LOO low output, FTO/FTC fail to open/close, SPO spurious operation, BRD breakdown, STD structural deficiency
- **maintainable item** (bearing, seal, impeller…)
- **failure mechanism** (wear, fatigue, corrosion, erosion, overheating, short circuiting…)
- **failure cause** (§2.4)
- **detection method**
- **severity** (critical / degraded / incipient)

How the sheet compares:

**Problems are mostly failure modes in substance.** Many map cleanly:

| SME problem | ISO failure mode |
|---|---|
| "No start" (151 classes) | FTS |
| "Noisy" (144) | NOI |
| "Vibration" (96) | VIB |
| "Overheating" (94) | OHE |
| "Leaking" (171) | ELP / ELU / INL. Ambiguous: it does not say which medium leaks or whether the leak is internal or external. |
| "Fails to open" / "Fails to close" | FTO / FTC |
| "Low pressure/flow", "Insufficient discharge" | LOO |

**Problems that are not failure modes:**
- Mechanisms: "Corrosion" (124 classes), "Erosion" (37), "Cracked" (34).
- Causes: `LA-P-16` "Improper daily maintenance", `LA-P-17` "Not strictly operating according to the processing scope", `LA-P-15` "Poor installation and assembly accuracy".
- Item failures: "Impeller worn/broken", "Thrust bearing failure".

**Failures are a mix of four kinds of thing:**
1. A maintainable item plus a mechanism: "Bearing worn" = item *bearing* + mechanism *wear*; "Seal leaking", "Shaft bent".
2. Causes: "Lack of lubrication", "Misalignment", "Improper lubricant", "Room ambient temperature too high".
3. Protective-device states: "Fuse blown", "Circuit breaker tripped" (208 and 114 occurrences).
4. **Effects, not causes**: `LA-F-43` "Processing quality is affected", `LA-F-44` "Production efficiency is affected", `LA-F-46` "Failure of the lathe", `LA-F-47` "Burns the bearings and even the main shaft".

None of the four is a single ISO field. To bring the content into the product, each row would have to be split into maintainable item + mechanism + cause.

**Missing that ISO expects.** There are no detection methods, no severity, no maintainable-item list and no mechanism list. The product supports all of these: `detection_method`, `failure_mechanism`, `failure_severity` critical/degraded/incipient on the event.

**Data-quality defects (must be fixed before any import):**
- **241 problems have no failure** (e.g. `AB-P-05` to `AB-P-09` on Absorber; `GRB-P-10` "Seized").
- **1,086 failure codes sit under two or more problems in the same class.** For example, `P3D-F-04` "Improper setting of fan speed" appears under P3D-P-01, P3D-P-10 and P3D-P-12. The "hierarchy" is really many-to-many.
- **Rows appear mis-paired, as if the two columns were sorted separately:**
  - `GRB-P-01` "Case cracked → Bearing worn/scored"; `GRB-P-02` "Contaminated → Gear box case cracked"; `GRB-P-03` "Input/output shaft leaking → Gear broken".
  - `RC-P-09` "Leaks air → Bearing seized"; `RC-P-12` "Leaks product → Bushing overheat".
- **Wrong domain for the class:**
  - `Silo` (21 problems) describes hand-made tin-sheet craft work (soldering iron, hammer blows, "lid necks"), not an industrial silo.
  - `Valve Safety/Relief` mostly describes a hydraulic circuit: "Pump drive motor not operating", "Inoperative servo valve", "Over-riding work load".
- **Extruder** (`EXR`, 13 problems / 31 failures) describes a profile/film line ("puller", "shrinkage"). It has nothing for a compounding/pelletising HDPE extruder (melt pump, screen changer, die plate, pelletiser knives, gearbox thrust bearing).
- **Duplicates and typos:** duplicate problem texts within a class, e.g. `P3D-P-03` "Prints sticking too much" vs `P3D-P-06` "Sticking too much". Typos such as "Rubber is orators in the shift linkage" (isolators) and "Hopper unplugged".

### 2.7 ISO 22400-2 and the planned/unplanned/external convention
- **No SME list carries an ISO 22400 time element or an OEE component** (availability / performance / quality). None says whether a stop is planned, unplanned or external.
- AM-Cause `UTILITY` and `3RDPARTY` match what the product treats as **external** stops (e.g. `FEED-STARVED`).
- AM-Action `Service`, `Inspection`, `Overhaul` and `Test` are what a **planned** maintenance stop does. But they are activity codes, not stop reasons.
- Everything in the hierarchical file is, by nature, **unplanned equipment failure**: ISO 22400 *unplanned downtime*, OEE *availability* loss.

---

## 3. Coverage for downtime and PLA reason coding

**Is any SME list a downtime reason list? No.** The AM-* files are maintenance/CMMS code lists:
- asset class, criticality and position describe the asset;
- action codes describe the work done;
- cause codes are a failure/RCA classification;
- the hierarchical file is a troubleshooting catalogue.

The product's **reason code library** (`reason_codes`: category, `default_schedule_class`, `default_oee_component`, parent tree) has no counterpart in the six files.

| Product need | Covered by the SME files? |
|---|---|
| Downtime reason tree (top level: planned / unplanned / external; then area or category; then reason) | **No.** No list has these classes, and HDPE-TRAIN's 8 codes (`ELEC-TRIP`, `MECH-GEARBOX`, `FEED-STARVED`, `GRADE-CHANGE`, `SPEED-LOSS`, `QUALITY-DOWNGRADE`…) have no SME equivalent beyond loose overlap. |
| Planned stop reasons (PM, grade change, cleaning, catalyst change, start-up/shutdown) | **No.** |
| External stop reasons (feed, utilities, logistics, market/no demand) | **Only as cause categories**: `EF`, `UTILITY`, `3RDPARTY`. These are not stop reasons. |
| Unplanned equipment-failure detail (the level under "Mechanical / Electrical") | **Partly.** The hierarchical file's problems for the relevant classes can serve as `failure_mode` and the class list as `equipment_class`. This feeds the failure fields on the event, not the reason code. |
| PLA rate/performance loss reasons (reduced rate, slow running, constraint) | **No.** At most a few symptom texts ("Efficiency loss", "Low capacity"). |
| PLA quality loss reasons (off-spec, downgrade, transition material) | **No.** The Extruder problems "Discoloured extrudate" and "Bubbles" are product defects on a different process. |
| RCA cause categories | **Yes**, AM-Cause List B (6M + Utility + Third party). |
| Failure cause classification (ISO) | **Partly**, AM-Cause List A (incomplete, see §2.4). |
| Maintenance activity on the repair | **Yes**, AM-Action, but the product has no field for it. |
| Asset criticality | **Yes**, but on a scale the product does not accept (High/Medium/Low only). |

**What still has to come from the SME** is a downtime and PLA reason list in the product's format: code, name, parent, planned/unplanned/external, availability/performance/quality.

---

## 4. Recommendations

| List | Decision | How / why | Target in product | Import path |
|---|---|---|---|---|
| AM-Action-Codes | **Add after mapping (later phase)** | Rename Troubleshoot → Check (keep the alias), map Construct → Other, add Combination and Other, define "calibration = Adjust". | No home today. Needs a new dictionary kind `maintenance_activity` and a field on work-order operations and/or the event. | Failure dictionary import (`POST /api/v2/…/failure-dictionary/import`, page `/master-data/failure-dictionary/import`) once the kind exists. 11 rows can also be entered by hand. |
| AM-Asset-Classes | **Add after mapping, HDPE subset only** | Load only the classes that exist on the HDPE line: Extruder, Gear Box, Gear Pump, Pump - Centrifugal, Compressor (Recip/Centrifugal), Blower, Motor Electric - AC Induction, VFD, Dryer, Silo, Feeder Gravimetric, Palletizer, Valve types used. Use the hierarchical file's prefix as the code (`EXR`, `GRB`, `PF`, `RC`, `MA`, `BLW`…), or ISO class codes if the SME prefers. Fill `assetTypes` with the HDPE `assets.asset_type` values. **Do not** load all 873: copies, OEM-model "classes", wastewater and machining classes. | `failure_dictionary_entries`, kind `equipment_class` | Existing failure dictionary import (CSV columns `kind,equipmentClass,code,name,description,category,assetTypes,isPending`; ≤ 5,000 rows per import). |
| AM-Asset-Criticality | **Do not add as-is** | The product field only accepts High/Medium/Low, and D17 / bad-actor depend on it. The scale is categorical rather than consequence-based, and the SME's own sample misapplies it. Options for an SME decision: (a) map 10/9/8/7 → High, 6/5 → Medium, 4–1 → Low; or (b) adopt a consequence-based High/Medium/Low matrix. Record the choice in `plans/DECISIONS.md`. | `assets.criticality` | Asset form or v2 asset API. There is **no asset bulk import** today. |
| AM-Cause List A (DSN/INST/OPR/MNT/EF) | **Add after mapping** | Use the codes as ISO cause *categories* in `failure_cause.category`, with concrete causes beneath each. Add Management and Miscellaneous/Unknown (the existing `CAUSE_PENDING` covers unknown). Split EF into "other unit / cascading" vs external. Put the 4 HDPE-TRAIN causes under categories: `LUBE_CONTAMINATION` → MNT, `INSPECTION_GAP` → MNT or Management, `COOLING_RESTRICTION` → DSN or MNT (SME to confirm). | `failure_dictionary_entries`, kind `failure_cause`, `category` column | Existing failure dictionary import. |
| AM-Cause List B (6M + Utility + 3rd party) | **Add after mapping** | Use as root nodes of the RCA cause tree. Map onto the existing roots: MAN → Personnel, MACHINE → Equipment, MATERIAL → Material, METHOD → Method, ENVIRO → Environment. New roots: MEASURE (Measurement), UTILITY, 3RDPARTY. Keep or retire the product's "Process" root by SME decision. | `rca_cause_codes` (root rows, `category`) | RCA causes tree editor (`POST /api/v2/rca-settings/causes`). No bulk import exists; 8 rows by hand is fine. |
| AM-Position-Sample | **Do not add** | Sample from a different (gas/refinery) plant, with criticality inconsistent with the scale. Use it only as a format template for an HDPE asset list: code, noun-first name, class, criticality, parent unit. | `assets` | No asset import exists. |
| Hierarchical problem/failure file | **Add after mapping, HDPE classes only, after cleaning** | **Problems** → `failure_mode` per class (code `EXR-P-01`…), after removing problems that are really mechanisms or causes (Corrosion, Erosion, "Improper daily maintenance") and tagging each with its ISO failure-mode equivalent (FTS/NOI/VIB/OHE/ELP/LOO…) in `category`. **Failures** → **do not import as-is**. Split by hand into `maintainable_item` (per class), `failure_mechanism` and `failure_cause` (plant-wide) for the HDPE subset. Fix the mis-paired Gear Box and Reciprocating Compressor rows and drop `Silo` and `Valve Safety/Relief` content. Write HDPE extruder modes from the plant's own history rather than using `EXR`. | `failure_dictionary_entries` (`failure_mode`, `maintainable_item`, `failure_mechanism`, `failure_cause`) | Existing failure dictionary import. The HDPE subset is a few hundred rows, well inside the 5,000 limit. |
| *(missing)* Downtime and PLA reason list | **Request from the SME** | A tree with planned / unplanned / external and availability / performance / quality on each leaf. The SME files cannot supply it. | `reason_codes` | Codes admin screen (`/master-data/codes-rules`). No bulk import for reason codes. |

---

## 5. Gaps to close before any import

1. **Class-bound causes / failures.** The DB check `CHK_failure_dictionary_entries_class` only lets `maintainable_item` and `failure_mode` carry an `equipment_class`. Mechanism, cause and detection method are plant-wide. Two ways forward:
   - Split the SME "failure" column into ISO fields (recommended; no schema change).
   - Add a class-bound kind (e.g. `class_failure_cause`): a migration that widens the check, plus a domain change in `failure-dictionary.ts`.
2. **Problem → failure link.** The dictionary has no parent column, so a failure cannot be tied to "its" problem. The SME data is many-to-many (1,086 shared codes). Keeping the link needs a mode→cause link table (migration + import format change). Without it, the event form offers all causes for any mode.
3. **Maintenance activity.** New kind `maintenance_activity` (check constraint + `DICTIONARY_KINDS`) and a field to store it (work-order operation and/or event). This is a public API change: update the OpenAPI snapshot.
4. **Criticality.** Either an SME decision to map to High/Medium/Low, or a configurable list replacing `ASSET_CRITICALITIES`. The second changes the DTO contract and affects D17 and the bad-actor report.
5. **Codes for classes.** AM-Asset-Classes has names only. A code rule is needed: SME prefix or ISO class code, ≤ 50 chars. Class names (≤ 49 chars) fit `name`.
6. **Asset type ↔ class binding.** HDPE assets need `asset_type` values that match the class `assetTypes`. Otherwise `classOfAssetType` cannot narrow the failure modes on an event.
7. **RCA cause code uniqueness.** `rca_cause_codes.code` is declared `unique: true` globally in the entity, not per tenant. Short SME codes such as `MAN` or `METHOD` would clash across tenants (HDPE1 and HDPE-TRAIN). Use tenant-neutral prefixes as today (`PE-…`, `EQ-…`), or fix the uniqueness in a migration.
8. **No bulk import for assets, reason codes or RCA causes.** Only the failure dictionary, standby, work-order operations and external reports have import endpoints. The small lists can be entered by hand; an HDPE asset list would need an asset import.
9. **Data cleaning (SME task):**
   - mis-paired rows (GRB, RC);
   - wrong-domain classes (Silo, Valve Safety/Relief);
   - 241 problems without failures;
   - effect-type "failures" (`LA-F-43`…`LA-F-47` style);
   - word-order duplicate classes;
   - encoding damage in the criticality sheet;
   - the 9 / 10 criticality values in the position sample.
10. **Product decisions to record** (`plans/DECISIONS.md`):
    - which cause top level is authoritative for RCA (ISO categories vs 6M);
    - whether "Process" stays as an RCA root;
    - the criticality scale;
    - whether Troubleshoot = Check.

---

## 6. Proposal: the downtime and PLA reason tree the SME files do not contain

A starting list for the SME to confirm, built on the ISO 22400-2 time model (planned downtime, unplanned downtime, external/not-scheduled time, rate loss, quality loss) and the OEE components the product already keys on. Codes that exist on HDPE-TRAIN today are marked (exists). Top-level nodes carry the schedule class and the OEE component; leaves inherit them.

| Parent | Code | Name | Schedule class | OEE component | Note |
|---|---|---|---|---|---|
| — | PLANNED | Planned stops | planned | availability | ISO 22400 planned downtime |
| PLANNED | PM-SCHEDULED | Scheduled maintenance | planned | availability | PM, turnaround, inspection |
| PLANNED | GRADE-CHANGE (exists) | Grade change | planned | availability | transition stop; transition off-spec goes to QUALITY |
| PLANNED | SCREEN-CHANGE | Screen pack change | planned | availability | the e2e message of 28 Oct used this code and it was unknown |
| PLANNED | CLEANING | Cleaning / die change | planned | availability | |
| PLANNED | STARTUP-SHUTDOWN | Planned start-up / shutdown | planned | availability | |
| PLANNED | NO-DEMAND | No demand / not scheduled | planned | availability | ISO 22400 excludes it from planned busy time; keep as a code so it is not booked as a loss |
| — | MECHANICAL (exists) | Mechanical | unplanned | availability | |
| MECHANICAL | MECH-GEARBOX (exists) | Gearbox failure | unplanned | availability | under DRIVE-TRAIN (exists) |
| MECHANICAL | MECH-PELLETIZER | Pelletizer / cutter failure | unplanned | availability | |
| MECHANICAL | MECH-MELT-PUMP | Melt pump failure | unplanned | availability | |
| MECHANICAL | MECH-BLOCKAGE | Die plate / line blockage | unplanned | availability | |
| MECHANICAL | MECH-SEAL-LEAK | Seal or flange leak | unplanned | availability | ISO 14224 ELP / ELU |
| — | ELECTRICAL | Electrical | unplanned | availability | |
| ELECTRICAL | ELEC-TRIP (exists) | Electrical trip | unplanned | availability | |
| ELECTRICAL | ELEC-MOTOR | Motor failure | unplanned | availability | |
| ELECTRICAL | ELEC-VFD | Drive (VFD) failure | unplanned | availability | |
| — | INSTRUMENT | Instrumentation and control | unplanned | availability | |
| INSTRUMENT | INST-SPURIOUS-TRIP | Spurious interlock trip | unplanned | availability | ISO 14224 SPO |
| INSTRUMENT | INST-FAILURE | Instrument / control failure | unplanned | availability | |
| — | PROCESS (exists as category) | Process | unplanned | availability | |
| PROCESS | PROC-REACTOR-UPSET | Reactor upset | unplanned | availability | |
| PROCESS | PROC-FOULING | Polymer fouling / plugging | unplanned | availability | |
| — | EXTERNAL | External | external | availability | outside the unit's control |
| EXTERNAL | FEED-STARVED (exists) | No upstream feed | external | availability | |
| EXTERNAL | UTIL-POWER | Power supply loss | external | availability | |
| EXTERNAL | UTIL-STEAM-N2-AIR | Steam, nitrogen or instrument air loss | external | availability | |
| EXTERNAL | UTIL-COOLING | Cooling water loss | external | availability | |
| EXTERNAL | DOWNSTREAM-FULL | Silo full / bagging unavailable | external | availability | |
| — | RATE | Rate loss | unplanned | performance | ISO 22400 speed loss; the PLA shortfall not explained by stops |
| RATE | SPEED-LOSS (exists) | Reduced extrusion rate | unplanned | performance | |
| RATE | RATE-UPSTREAM | Rate limited by upstream | external | performance | |
| RATE | RATE-CATALYST | Catalyst activity / recipe | unplanned | performance | |
| RATE | MINOR-STOPS | Minor stops (below the stop threshold) | unplanned | performance | |
| — | QUALITY | Quality loss | unplanned | quality | |
| QUALITY | QUALITY-DOWNGRADE (exists) | Quality downgrade | unplanned | quality | |
| QUALITY | TRANSITION-OFFSPEC | Transition off-spec | planned | quality | pairs with GRADE-CHANGE |
| QUALITY | REPROCESS | Rework / reprocess | unplanned | quality | |

Rules to apply with it:
- A stop carries one availability reason; the PLA day is coded with the reasons of its shortfall (availability, performance or quality), so the same library serves both, as it does today.
- The schedule class and OEE component are set once on the parent; leaves inherit, so the SME edits one row when the plant changes its convention.
- ISO 14224 failure coding (mode, mechanism, cause, maintainable item, detection) stays on the event's failure fields and in the failure dictionary; it does not duplicate the reason tree.
- Entry today is by hand in Codes admin (`/master-data/codes-rules`); 40 rows are about an hour. A CSV import for reason codes would be a small follow-up if the SME wants to iterate.
