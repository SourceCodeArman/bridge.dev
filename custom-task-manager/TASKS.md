# Bridge.dev - Development Task List

This document outlines all tasks needed to build the MVP of Bridge.dev, a no-code integration platform.

**Last Updated:** 2025-12-23  
**Status:** In Progress - Phase 0 Complete

---

## Phase 0: Foundation

- [x] 1. **Establish config and settings**
  - [x] Add .env loading with Supabase connection and secrets abstraction
  - [x] Provide per-environment settings (dev/prod) with sane defaults
  - [x] Document required environment variables for self-host
- [x] 2. **Implement authN/RBAC scaffold**
  - [x] Create users/orgs/workspaces models and JWT auth
  - [x] Seed default roles and permissions model
  - [x] Add middleware/guards for workspace scoping
- [x] 3. **Define core workflow data models**
  - [x] Implement Workflow, WorkflowVersion, Run, RunStep, Trigger schemas
  - [x] Add migrations and validation constraints
  - [x] Expose admin/read APIs for models
- [x] 4. **Add structured logging utilities**
  - [x] Standardize log format and correlation IDs
  - [x] Add base logging configuration for API and workers
  - [x] Document logging usage patterns

## Phase 1: Orchestration Core

- [ ] 5. **Build queue and orchestrator**
  - [ ] Set up Celery + Redis with retry and DLQ policies
  - [ ] Implement run lifecycle state machine
  - [ ] Add worker health checks/metrics
- [ ] 6. **Implement trigger ingest**
  - [ ] Webhook trigger endpoint with validation and dedupe
  - [ ] Cron/manual trigger pathways
  - [ ] Enqueue execution requests via orchestrator
- [ ] 7. **Add concurrency and rate limiting**
  - [ ] Per-workflow concurrency caps
  - [ ] Backoff and queueing strategy
  - [ ] Configurable defaults via settings
- [ ] 8. **Persist run state and step outputs**
  - [ ] Store step inputs/outputs with schemas
  - [ ] Track run status transitions
  - [ ] Add idempotency keys for replays

## Phase 2: Connectors & Secrets

- [ ] 9. **Implement credential vault**
  - [ ] Encrypt secrets at rest and mask in logs
  - [ ] Scope secrets to user/workspace with RBAC checks
  - [ ] Add CRUD APIs for credentials
- [ ] 10. **Deliver connector SDK**
  - [ ] Define connector manifest schema and validation
  - [ ] Provide lifecycle hooks for init/execute
  - [ ] Publish example connector package
- [ ] 11. **Ship Supabase DB trigger connector**
  - [ ] Listen to Supabase realtime events
  - [ ] Map events to workflow payloads
  - [ ] Add configuration UI fields/schema
- [ ] 12. **Ship Slack connector**
  - [ ] OAuth/API key auth flow
  - [ ] Send message action and channel selector
  - [ ] Error handling with retries/backoff
- [ ] 13. **Ship Google connectors (Gmail, Sheets)**
  - [ ] OAuth flow and token refresh handling
  - [ ] Gmail send/read actions; Sheets read/write actions
  - [ ] Input/output schema validation
- [ ] 14. **Ship HTTP & Webhook connectors**
  - [ ] Generic HTTP request node with templating
  - [ ] Outbound webhook sender
  - [ ] Response parsing and error surfacing
- [ ] 15. **Ship LLM connectors (OpenAI, Anthropic, Gemini, DeepSeek)**
  - [ ] API key-based auth and model selection
  - [ ] Text generation node with safety controls
  - [ ] Cost/usage metadata capture

## Phase 3: AI Assistance

- [ ] 16. **Build prompt-to-workflow draft generator**
  - [ ] Convert natural language goals to workflow graph
  - [ ] Select nodes and prefill parameters from connectors
  - [ ] Validate against workflow schema before saving
- [ ] 17. **Add error-to-fix suggestions**
  - [ ] Ingest run logs and traces for context
  - [ ] Generate actionable suggestions per failing step
  - [ ] Surface fixes in UI with apply option
- [ ] 18. **Implement LLM guardrails and redaction**
  - [ ] Strip/mask secrets from prompts and logs
  - [ ] Enforce allowlist of fields sent to LLMs
  - [ ] Add tests to prevent secret leakage

## Phase 4: Observability & Alerts

- [ ] 19. **Implement run and step logging/tracing**
  - [ ] Structured logs per run/step with correlation IDs
  - [ ] Trace viewer API for frontend
  - [ ] Filtering by workflow/time/status
- [ ] 20. **Add alerts and webhooks on failure/timeout**
  - [ ] Subscribe to run failure/timeout events
  - [ ] Send email/slack/webhook notifications with throttling
  - [ ] Configure alert preferences per workflow
- [ ] 21. **Enable replay and partial rerun**
  - [ ] Persist payloads for safe replay
  - [ ] Allow rerun from failed step with prior outputs
  - [ ] Record replay lineage and outcomes

## Phase 5: Frontend Experience

- [ ] 22. **Deliver canvas builder**
  - [ ] Drag/drop nodes and draw edges with validation
  - [ ] Autosave drafts and version awareness
  - [ ] Prevent cycles/invalid graphs client-side
- [ ] 23. **Build schema-driven node editor**
  - [ ] Render forms from connector manifests
  - [ ] Validate required fields before publish
  - [ ] Support secrets/credential selection UX
- [ ] 24. **Publish templates and recipes library**
  - [ ] Curate starter flows (webhook→LLM→Slack, DB trigger→Sheets)
  - [ ] One-click clone into drafts
  - [ ] Placeholder binding for credentials/config
- [ ] 25. **Add collaboration (presence and comments)**
  - [ ] Presence indicators on canvas
  - [ ] Inline comments on nodes/edges
  - [ ] Role checks for edit/comment permissions

## Phase 6: Extensibility

- [ ] 26. **Support user-contributed nodes**
  - [ ] Allow upload/registration of custom connectors
  - [ ] Validate manifest and enforce versioning
  - [ ] Add approval/publishing workflow
- [ ] 27. **Sandbox execution for custom nodes**
  - [ ] Isolate execution with resource/time limits
  - [ ] Enforce network and secret access policies
  - [ ] Add monitoring for sandboxed runs

---

## Task Priority & Dependency Chart

 ----------------------------------------------------
| TASK | PRIORITY |              DEPS                |
 ----------------------------------------------------
|  1   |   HIGH   |   0                              |
|  2   |   HIGH   |   1                              |
|  3   |   HIGH   |   1                              |
|  4   |   MED    |   1                              |
|  5   |   HIGH   |   1,3,4                          |
|  6   |   MED    |   5                              |
|  7   |   MED    |   5                              |
|  8   |   HIGH   |   3,5                            |
|  9   |   HIGH   |   1,2                            |
|  10  |   HIGH   |   1                              |
|  11  |   MED    |   5,9,10                         |
|  12  |   MED    |   5,9,10                         |
|  13  |   MED    |   5,9,10                         |
|  14  |   MED    |   5,9,10                         |
|  15  |   MED    |   5,9,10                         |
|  16  |   MED    |   3,10,15                        |
|  17  |   MED    |   5,19                           |
|  18  |   HIGH   |   9,16                           |
|  19  |   HIGH   |   5,8                            |
|  20  |   MED    |   19                             |
|  21  |   MED    |   5,8,19                         |
|  22  |   HIGH   |   3,10                           |
|  23  |   MED    |   10,22                          |
|  24  |   MED    |   10,22                          |
|  25  |   MED    |   2,22                           |
|  26  |   MED    |   9,10,27                        |
|  27  |   HIGH   |   5,9                            |
 ----------------------------------------------------

---

## Progress Summary

**Status:** 4 done | 23 pending | 0 in progress
**Completion:** 15% (4/27 tasks completed)

*Note: Tasks marked with `[x]` are done, `[~]` are in progress, and `[ ]` are pending. Run `node custom-task-manager/tasks-cli.js` for an interactive progress view.*

