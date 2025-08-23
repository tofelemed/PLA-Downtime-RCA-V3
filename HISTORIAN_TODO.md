# Historian TODO and Final Docs Checklist

This document tracks remaining tasks for the modular Historian implementation and the final documentation deliverable. Backend work is deferred for now.

## Frontend (current milestone)

- [x] Add PI Streams support in `PIClient` (recorded, interpolated, summary, plot) and attribute→stream resolution
- [x] Introduce provider-based Historian SDK (`HistorianClient`, provider interface, PI provider)
- [x] New Historian tab (query form, chart, table, quality summary, CSV export)
- [x] AF Attributes → "View history" action to open Historian prefilled
- [x] EventHub mini sparkline around event window
- [x] RCA: attach "Time Series" evidence by saving query signature (provider, stream, window), render on demand
- [x] Dashboard micro-trends: show current value and small trend on Unit/Asset cards for selected key tags
- [x] Historian Tag Configuration: Browse PI AF hierarchy and configure tags for dashboard monitoring
- [ ] ProductionOutput from historian: aggregate count/rate tags into `ProductionOutput` events (plan windows)
- [ ] IOW/SOL from historian: threshold/excursion detection to create events when EF not available
- [ ] APM health from historian: simple rolling stats-based anomaly alerts to `APM` events
- [ ] Watermarks for historian pulls (client-side IndexedDB for DEV)

## Backend (deferred)

- [ ] HistorianModule (NestJS) with provider registry (PI first)
- [ ] Secure connection storage (per-tenant), secrets in env/vault
- [ ] Endpoints: `POST /api/historian/query`, `POST /api/historian/resolve-streams`, `GET /api/historian/status`
- [ ] JWT auth, audit logging, basic rate limiting
- [ ] Streamsets batching for multi-tag performance
- [ ] Optional cache/index for commonly viewed ranges
- [ ] Schedulers for delta pulls/materialized summaries (optional)

## Final documentation deliverable (to generate when features complete)

Generate a comprehensive markdown file (name: `HISTORIAN_FEATURES.md`) covering:

- Overview: goals, architecture (provider model, FE/BE responsibilities)
- How to use: Historian tab, AF "View history", EventHub sparkline, RCA time-series evidence
- Supported modes: recorded/interpolated/summary/plot (with parameters)
- Quality and health: flags, quality summary, endpoint connectivity
- Derived events: IOW/SOL/APM/ProductionOutput – configuration and examples
- Storage and tenancy: what is cached locally, how events are persisted
- Security: DEV vs PROD flows, credential handling
- Performance tips: batching, downsampling, pagination
- Extensibility: adding new providers (InfluxDB/ADX/etc.)
- Future work (if any items remain from Backend/Frontend sections)

> Note: Backend section remains a TODO until scheduled. This document will be generated at the end of the Historian feature set.

