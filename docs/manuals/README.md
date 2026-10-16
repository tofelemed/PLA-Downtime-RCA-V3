# Traverse Forge application manuals

The five Word manuals document product revision `2f385d2` and the local HDPE
validation edition dated 16 October 2026. Start with the application logic guide,
then the persona guide to assign preparation, approval and closure duties. Use
the setup guide for commissioning, the page manual as the field reference and
the operations guide for routine work, troubleshooting and validation boundaries.

| Document | Purpose |
| --- | --- |
| [Page and Field Manual](01_Page_and_Field_Manual.docx) | Every route family, page, subpage, field, conditional control, filter and action in the source inventory |
| [Application Logic and Data Flows](02_Application_Logic_and_Data_Flows.docx) | Architecture, permissions, production accounting, finance, RCA, API consistency and data lifecycle |
| [New Plant Setup Guide](03_New_Plant_Setup_Guide.docx) | Fourteen ordered setup stages, deployment variables and detailed configuration and commissioning procedures |
| [Operations and Verification Guide](04_Operations_and_Verification_Guide.docx) | Daily work, persona responsibilities, recovery, release checks and known limits |
| [Persona Responsibilities and Approvals](05_Persona_Responsibilities_and_Approvals.docx) | 35 workflow families, nine worked handoffs, independence rules and all 52 named HDPE personas with roles and scopes |

The inventory reconciles 95 route declarations, including the development-only
route, through 95 page groups and 2,080 field/display entries. Repeatable row
definitions and dynamic control families are described once. Source coverage is
separate from runtime-state test coverage. The manuals identify synthetic examples
and do not present the HDPE test values as approved settings for another plant.

The persona guide distinguishes recommended accountability from actual permission
checks. It identifies who prepares, submits, approves, rejects and closes work,
including self-approval restrictions and workflows with direct save/publish
commands. The roster covers 12 canonical scope roles, seven legacy/global role
mappings and 70 distinct explicit grants. It records the seed baseline, not a
promise that later membership changes will preserve that access.

## Reproduction

Source prose and structured inventories are in `source/`. The builders require
the Codex bundled Python runtime with python-docx, lxml and pypdf. The rasterizer
uses Poppler from the same bundled dependencies. The supplied Windows renderer
uses a hidden, task-owned Word COM instance and closes only its own documents.
The packaged LibreOffice renderer was attempted first but was unavailable on this
host; its diagnostic log is retained.

1. Run `scripts/audit-manual-coverage.py` and resolve every missing route,
   required property or source reference.
2. Run `scripts/build-application-manuals.py` to build all five files. `--only 01`
   through `--only 05` saves one selected document without replacing the others.
3. Run `scripts/render-manuals-word.ps1` to update the contents and pagination and
   export QA PDFs. `-FileName` can select one document.
4. Run `scripts/rasterize-manuals.py --output accepted` to create individual page
   PNGs. Each page uses an independent Poppler process with bounded concurrency.
5. Run `scripts/validate-application-manuals.py` for structural checks, every field
   description in its page/section, persona/workflow presence, contents fields,
   credential exclusions, PDF footers and final document hashes.
6. Inspect every page image at original resolution. Rebuild and re-render after
   any correction. Keep each reviewer receipt tied to the final image hashes.

QA PDFs and PNGs live under `test-results/manual-qa/` and are not additional user
deliverables. The Word files are the deliverables. Preserve the relevant source
revision and regenerate the manuals when behavior, fields or routes change.

## Final acceptance

The five documents contain 592 rendered pages (292, 17, 257, 9 and 17).
Structural validation, full field-description reconciliation, persona/workflow
coverage and visual review passed. All original pages and every changed body were
individually reviewed; exact body hashes preserve earlier review for unchanged
pages, and every final PDF footer was checked. Final hashes and review provenance
are recorded in `verification.json` and `verification-pages.json`.
