# Bridge.dev - Development Task List

This document outlines all tasks needed to build the MVP of Bridge.dev, a no-code integration platform.

**Last Updated:** 2026-01-13
**Status:** In Progress - Phase 8, 9 & Phase 10 (Connector Functionality & Data Flow)

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

- [x] 5. **Build queue and orchestrator**
  - [x] Set up Celery + Redis with retry and DLQ policies
  - [x] Implement run lifecycle state machine
  - [x] Add worker health checks/metrics
- [x] 6. **Implement trigger ingest**
  - [x] Webhook trigger endpoint with validation and dedupe
  - [x] Cron/manual trigger pathways
  - [x] Enqueue execution requests via orchestrator
- [x] 7. **Add concurrency and rate limiting**
  - [x] Per-workflow concurrency caps
  - [x] Backoff and queueing strategy
  - [x] Configurable defaults via settings
- [x] 8. **Persist run state and step outputs**
  - [x] Store step inputs/outputs with schemas
  - [x] Track run status transitions
  - [x] Add idempotency keys for replays

## Phase 2: Connectors & Secrets

- [x] 9. **Implement credential vault**
  - [x] Encrypt secrets at rest and mask in logs
  - [x] Scope secrets to user/workspace with RBAC checks
  - [x] Add CRUD APIs for credentials
- [x] 10. **Deliver connector SDK**
  - [x] Define connector manifest schema and validation
  - [x] Provide lifecycle hooks for init/execute
  - [x] Publish example connector package
- [x] 11. **Ship Supabase DB trigger connector**
  - [x] Listen to Supabase realtime events
  - [x] Map events to workflow payloads
  - [x] Add configuration UI fields/schema
- [x] 12. **Ship Slack connector**
  - [x] OAuth/API key auth flow
  - [x] Send message action and channel selector
  - [x] Error handling with retries/backoff
- [x] 13. **Ship Google connectors (Gmail, Sheets)**
  - [x] OAuth flow and token refresh handling
  - [x] Gmail send/read actions; Sheets read/write actions
  - [x] Input/output schema validation
- [x] 14. **Ship HTTP & Webhook connectors**
  - [x] Generic HTTP request node with templating
  - [x] Outbound webhook sender
  - [x] Response parsing and error surfacing
- [x] 15. **Ship LLM connectors (OpenAI, Anthropic, Gemini, DeepSeek)**
  - [x] API key-based auth and model selection
  - [x] Text generation node with safety controls
  - [x] Cost/usage metadata capture

## Phase 3: AI Assistance

- [x] 16. **Build prompt-to-workflow draft generator**
  - [x] Convert natural language goals to workflow graph
  - [x] Select nodes and prefill parameters from connectors
  - [x] Validate against workflow schema before saving
- [x] 17. **Add error-to-fix suggestions**
  - [x] Ingest run logs and traces for context
  - [x] Generate actionable suggestions per failing step
  - [x] Surface fixes in UI with apply option
- [x] 18. **Implement LLM guardrails and redaction**
  - [x] Strip/mask secrets from prompts and logs
  - [x] Enforce allowlist of fields sent to LLMs
  - [x] Add tests to prevent secret leakage

## Phase 4: Observability & Alerts

- [x] 19. **Implement run and step logging/tracing**
  - [x] Structured logs per run/step with correlation IDs
  - [x] Trace viewer API for frontend
  - [x] Filtering by workflow/time/status
- [x] 20. **Add alerts and webhooks on failure/timeout**
  - [x] Subscribe to run failure/timeout events
  - [x] Send email/slack/webhook notifications with throttling
  - [x] Configure alert preferences per workflow
- [x] 21. **Enable replay and partial rerun**
  - [x] Persist payloads for safe replay
  - [x] Allow rerun from failed step with prior outputs
  - [x] Record replay lineage and outcomes

## Phase 5: Frontend Experience

- [x] 22. **Deliver canvas builder**
  - [x] Drag/drop nodes and draw edges with validation
  - [x] Autosave drafts and version awareness
  - [x] Prevent cycles/invalid graphs client-side
- [x] 23. **Build schema-driven node editor**
  - [x] Render forms from connector manifests
  - [x] Validate required fields before publish
  - [x] Support secrets/credential selection UX
- [x] 24. **Publish templates and recipes library**
  - [x] Curate starter flows (webhook→LLM→Slack, DB trigger→Sheets)
  - [x] One-click clone into drafts
  - [x] Placeholder binding for credentials/config
- [x] 25. **Add collaboration (presence and comments)**
  - [x] Presence indicators on canvas
  - [x] Inline comments on nodes/edges
  - [x] Role checks for edit/comment permissions

## Phase 6: Extensibility

- [x] 26. **Support user-contributed nodes**
  - [x] Allow upload/registration of custom connectors
  - [x] Validate manifest and enforce versioning
  - [x] Add approval/publishing workflow
- [x] 27. **Sandbox execution for custom nodes**
  - [x] Isolate execution with resource/time limits
  - [x] Enforce network and secret access policies
  - [x] Add monitoring for sandboxed runs

## Phase 7: Frontend Foundation

- [x] 28. **Project setup and configuration**
  - [x] Initialize React + TypeScript project with Vite
  - [x] Configure Tailwind CSS and shadcn/ui
  - [x] Set up project structure (components, pages, hooks, utils, types)
  - [x] Configure ESLint, Prettier, and TypeScript strict mode
  - [x] Set up environment variables for API endpoints
  - [x] Configure path aliases (@/components, @/lib, etc.)
  - [x] Set up React Router with protected routes
  - [x] Initialize React Query with API client setup
- [x] 29. **Authentication pages and flow**
  - [x] Build Login page with JWT token handling
  - [x] Build Register page with validation
  - [x] Implement auth context/provider for user state
  - [x] Create protected route wrapper component
  - [x] Add token refresh logic and auto-logout on expiry
  - [x] Build password reset flow (if backend supports)
  - [x] Add loading states and error handling for auth
- [x] 30. **Core layout components**
  - [x] Build main App layout with sidebar navigation
  - [x] Create responsive Navbar component
  - [x] Build Sidebar with navigation menu
  - [x] Create Footer component
  - [x] Implement breadcrumb navigation
  - [x] Add user menu dropdown (profile, settings, logout)
  - [x] Build loading skeletons and spinners
  - [x] Create toast notification system
  - [x] Add error boundary component
- [x] 31. **API client and type definitions**
  - [x] Create API client with Axios and interceptors
  - [x] Define TypeScript types for all API responses
  - [x] Implement API service functions for all endpoints
  - [x] Add error handling and retry logic
  - [x] Implement request/response interceptors for auth tokens

## Phase 8: Core Pages

- [x] 32. **Dashboard/home page**
  - [x] Build dashboard layout with stats cards
  - [x] Display workflow overview (total, active, recent)
  - [x] Show recent runs with status indicators
  - [x] Add quick actions (create workflow, view templates)
  - [x] Display activity feed or recent events
  - [x] Add charts/graphs for run statistics
  - [x] Implement real-time updates for run status
  - [x] Add filtering and date range selection
- [x] 33. **Workflow canvas builder page**
  - [x] Integrate React Flow or similar canvas library
  - [x] Build node palette with connector types (AddNodeSheet with category pages)
  - [x] Implement drag-and-drop node creation
  - [x] Build edge/connection drawing between nodes
  - [x] Create node configuration panel (schema-driven NodeConfigPanel)
  - [x] Add workflow validation (cycles, required fields, isValidConnection)
  - [x] Implement autosave for draft workflows (debounced save)
  - [x] Add version management UI (WorkflowVersionViewSet)
  - [x] Build workflow publish/activate flow (activate switch in toolbar)
  - [x] Add undo/redo functionality (via AI Assistant)
  - [x] Implement zoom, pan, and minimap controls
  - [~] Add collaboration features (presence indicators, comments)
- [x] 34. **Workflow list and management page**
  - [x] Build workflow list table with sorting/filtering (WorkflowsPage)
  - [x] Add search functionality
  - [x] Display workflow status, version, last run info
  - [x] Add quick actions (edit, duplicate, delete, run manually)
  - [x] Create workflow creation modal/form
  - [x] Build workflow detail view/modal
  - [~] Add bulk actions (delete multiple, activate/deactivate)
  - [x] Implement pagination
  - [x] Add workflow status badges and indicators
- [x] 35. **Workflow runs/history page**
  - [x] Build runs list table with filters
  - [x] Display run details (status, duration, trigger type, steps)
  - [x] Create run detail view/modal with step-by-step breakdown
  - [x] Add run logs viewer with filtering
  - [~] Implement trace viewer for run execution flow
  - [x] Add replay/rerun functionality UI
  - [ ] Build run comparison view (for replays)
  - [ ] Add export functionality for run data
  - [ ] Implement real-time updates for running workflows
- [x] 36. **Templates library page**
  - [x] Build template grid/list view with search
  - [x] Display template cards with preview, description, tags
  - [x] Add template detail modal/page
  - [x] Implement one-click template cloning
  - [x] Build template categories/filters
  - [x] Add template preview (read-only workflow view)
  - [x] Show template usage stats
  - [x] Add "Create from template" flow
- [x] 37. **Settings page**
  - [x] Build settings page with tabbed navigation
  - [x] Create account settings section
  - [x] Add workspace settings
  - [x] Build notification preferences
  - [x] Add API settings section
  - [x] Create billing/subscription section (if applicable)
  - [x] Add danger zone (delete account, workspace)
  - [x] Implement settings persistence and validation
- [~] 38. **API keys/credentials management page**
  - [x] Build credentials list table with masked values
  - [x] Add create credential form
  - [x] Implement credential type selector
  - [x] Build credential detail/edit modal
  - [ ] Add credential usage tracking display
  - [x] Implement credential deletion with confirmation
  - [ ] Add credential testing/validation UI
  - [ ] Build credential sharing/workspace assignment UI
  - [ ] Add credential encryption status indicators
- [x] 39. **Connectors and custom connector page**
  - [x] Build node type selector/catalog (ConnectorsPage)
  - [x] Display available connectors with descriptions
  - [x] Create node configuration form builder (schema-driven)
  - [x] Add node action selector (for multi-action connectors)
  - [x] Build node input/output schema viewer
  - [x] Implement node validation preview (NodePreview)
  - [x] Add custom connector upload/registration UI (CreateCustomConnectorPage wizard)
  - [x] Build node manifest viewer/editor
  - [x] Add node testing/sandbox UI (via test connector loading script)
- [~] 40. **Alerts/notifications page**
  - [x] Build alert configurations list
  - [x] Create alert configuration form
  - [ ] Add alert history table with filtering
  - [x] Build alert channel management (email, Slack, webhook)
  - [x] Implement alert test/send functionality
  - [x] Add alert status indicators and metrics
  - [ ] Build notification preferences UI
  - [x] Create alert detail view with history
- [~] 41. **User profile page**
  - [x] Build profile information display/edit form
  - [x] Add avatar upload functionality
  - [x] Display user activity summary
  - [x] Show user's workflows and contributions
  - [ ] Add account deletion option
  - [x] Build password change form
  - [ ] Add email verification status
- [x] 42. **Workspace/team management page**
  - [x] Build workspace members list table
  - [x] Add invite member functionality
  - [x] Create role assignment UI (RBAC)
  - [x] Build permission management interface
  - [x] Add member removal functionality
  - [x] Display workspace settings
  - [x] Build workspace switching UI (if multi-workspace)
  - [x] Add workspace activity log
- [x] 43. **Documentation pages**
  - [x] Build documentation layout with sidebar navigation
  - [x] Create getting started guide
  - [x] Add API documentation page
  - [x] Build connector documentation pages
  - [x] Create workflow examples/tutorials
  - [x] Add FAQ section
  - [x] Build search functionality for docs
  - [x] Add code examples and snippets
  - [x] Create interactive tutorials/walkthroughs

## Phase 9: Advanced Features

- [~] 44. **Real-time features**
  - [ ] Implement WebSocket client for run status updates
  - [ ] Add real-time presence indicators on canvas
  - [ ] Build live collaboration features (cursors, comments)
  - [x] Add real-time notification system (toast notifications)
  - [x] Implement optimistic UI updates (implemented across canvas)
- [~] 45. **Error handling and user feedback**
  - [x] Build comprehensive error boundary system
  - [x] Create error pages (404, 500, network errors)
  - [x] Add form validation with helpful error messages
  - [x] Implement retry mechanisms for failed requests
  - [ ] Build error reporting/logging to backend
  - [x] Add user-friendly error messages and recovery actions
- [ ] 46. **Performance optimization**
  - [ ] Implement code splitting and lazy loading
  - [ ] Add route-based code splitting
  - [ ] Optimize bundle size
  - [ ] Add image optimization and lazy loading
  - [ ] Implement virtual scrolling for large lists
  - [ ] Add memoization for expensive components
  - [ ] Optimize React Query cache strategies
- [ ] 47. **Testing and quality assurance**
  - [ ] Set up testing framework (Vitest + React Testing Library)
  - [ ] Write unit tests for utility functions
  - [ ] Add component tests for critical UI components
  - [ ] Implement integration tests for key flows
  - [ ] Add E2E tests for critical user journeys
  - [ ] Set up CI/CD for frontend testing
- [ ] 48. **Accessibility and responsive design**
  - [ ] Ensure WCAG 2.1 AA compliance
  - [ ] Add keyboard navigation support
  - [ ] Implement screen reader support
  - [ ] Build responsive layouts for mobile/tablet
  - [ ] Add touch-friendly interactions for canvas
  - [ ] Test with various screen sizes and devices
  - [ ] Add focus management and skip links

## Phase 10: Connector Functionality & Data Flow

- [ ] 49. **Rigorous connector testing suite**
  - [ ] Create comprehensive test cases for each connector (OpenAI, Anthropic, Gemini, DeepSeek, Slack, Gmail, Google Sheets, Supabase, MongoDB, Redis, Postgres, HTTP, Webhook)
  - [ ] Test authentication flows (API key, OAuth, token refresh)
  - [ ] Test error handling and retry logic for each connector
  - [ ] Test edge cases (rate limits, timeouts, invalid inputs, network failures)
  - [ ] Test credential encryption/decryption in connector context
  - [ ] Add integration tests with mocked external APIs
  - [ ] Add end-to-end tests with real API calls (sandbox/test accounts)
  - [ ] Document test coverage and known limitations per connector
- [ ] 50. **Webhook trigger full functionality**
  - [ ] Implement webhook URL generation per workflow
  - [ ] Add webhook signature verification (HMAC-SHA256)
  - [ ] Support multiple HTTP methods (GET, POST, PUT, DELETE)
  - [ ] Add request body parsing (JSON, form-data, raw)
  - [ ] Implement header extraction and forwarding
  - [ ] Add query parameter parsing and mapping to workflow inputs
  - [ ] Support webhook authentication (API key, bearer token, basic auth)
  - [ ] Add webhook event filtering and conditional triggering
  - [ ] Implement webhook response customization (status code, body, headers)
  - [ ] Add webhook logs and debugging UI
  - [ ] Test with common webhook providers (GitHub, Stripe, Twilio, etc.)
- [ ] 51. **Supabase realtime trigger functionality**
  - [ ] Implement Supabase realtime subscription management
  - [ ] Support table-level change events (INSERT, UPDATE, DELETE)
  - [ ] Add row-level filtering (e.g., trigger only when status='active')
  - [ ] Support multiple table subscriptions per workflow
  - [ ] Implement connection pooling and reconnection logic
  - [ ] Add event payload transformation to workflow input schema
  - [ ] Support Supabase RLS (Row Level Security) context
  - [ ] Add realtime connection health monitoring
  - [ ] Implement graceful disconnection and cleanup on workflow deactivation
  - [ ] Test with various Supabase table schemas and event types
- [ ] 52. **AI Agent resource nodes expansion**
  - [ ] Implement Model Selector node (choose LLM provider/model dynamically)
  - [ ] Add Memory Store node (conversation history, context persistence)
    - [ ] Support in-memory, Redis, and database-backed memory
    - [ ] Add memory retrieval strategies (recent N, semantic search, summarization)
  - [ ] Implement Tool Registry node (define callable tools for agent)
    - [ ] Support HTTP endpoint tools
    - [ ] Support inline code tools
    - [ ] Support other workflow nodes as tools
  - [ ] Add Agent Executor node (orchestrate model + memory + tools)
  - [ ] Implement Prompt Template node (dynamic prompt construction)
  - [ ] Add RAG (Retrieval-Augmented Generation) node
    - [ ] Support vector store integration (Supabase pgvector, Pinecone, etc.)
    - [ ] Add document chunking and embedding generation
  - [ ] Implement Agent Loop node (multi-turn agent execution)
  - [ ] Add token usage and cost tracking per agent run
- [ ] 53. **Complete node functionality implementation**
  - [ ] Audit all existing nodes for missing functionality
  - [ ] Implement Condition node branching logic with complex expressions
  - [ ] Add Loop/Iterator node for processing arrays
  - [ ] Implement Delay/Wait node with configurable duration
  - [ ] Add Transform node (JSONata, Jinja2, JavaScript expressions)
  - [ ] Implement Merge node (combine outputs from parallel branches)
  - [ ] Add Filter node (filter arrays based on conditions)
  - [ ] Implement Switch/Router node (multi-path branching)
  - [ ] Add Error Handler node (try/catch for workflow steps)
  - [ ] Implement Sub-workflow node (call other workflows as steps)
  - [ ] Test each node type with various input configurations
  - [ ] Add node-specific validation rules and error messages
- [ ] 54. **Input/output data flow management**
  - [ ] Implement upstream output reference system (e.g., `{{node_1.output.field}}`)
  - [ ] Build visual data mapper UI for connecting node outputs to inputs
  - [ ] Add autocomplete for available upstream outputs in node config
  - [ ] Implement type coercion and validation between node connections
  - [ ] Support nested object and array path references
  - [ ] Add JSONPath/dot notation for deep field access
  - [ ] Implement expression builder for data transformations
  - [ ] Add data preview panel showing sample values from previous runs
  - [ ] Support default values and fallbacks for missing upstream data
  - [ ] Implement input validation against node schema before execution
  - [ ] Add data flow debugging/tracing view in run details
  - [ ] Test complex multi-node data flows with various data types

---

## System Connector Functionality Checklist

This section tracks all system-provided connectors, their available actions, and implementation status.

### Google Connectors

#### Google Sheets (`google-sheets`)
- **Auth Type**: OAuth 2.0
- **Actions**:
  - [x] Read Range
    - [x] Spreadsheet ID (Dynamic Selector)
    - [x] Worksheet Name (Dynamic Selector)
    - [x] Range (Text Input)
  - [x] Write Range
    - [x] Spreadsheet ID (Dynamic Selector)
    - [x] Worksheet Name (Dynamic Selector)
    - [x] Range (Text Input)
    - [x] Values (Json Input)
  - [x] Append Rows
    - [x] Spreadsheet ID (Dynamic Selector)
    - [x] Worksheet Name (Dynamic Selector)
    - [x] Values (Json Input)
  - [x] Clear Range
    - [x] Spreadsheet ID (Dynamic Selector)
    - [x] Worksheet Name (Dynamic Selector)
    - [x] Range (Text Input)
  - [x] Create Spreadsheet
    - [x] Spreadsheet Name (Text Input)
  - [x] Add Worksheet
    - [x] Spreadsheet ID (Dynamic Selector)
    - [x] Worksheet Name (Text Input)
  - [x] List Worksheets
    - [x] Spreadsheet ID (Dynamic Selector)

#### Google Calendar (`google-calendar`)
- **Auth Type**: OAuth 2.0
- **Actions**:
  - [x] Create Event
    - [x] Calendar ID (Dynamic Selector)
    - [x] Summary (Text Input)
    - [x] Description (Text Input)
    - [x] Location (Text Input)
    - [x] Start Time (Date and Time Input)
    - [x] End Time (Date and Time Input)
    - [x] Timezone (Text Input)
    - [x] Attendees (Text Input)
    - [x] Send Notifications (Checkbox Input)
    - [x] Reminders (Text Input)
    - [x] Recurrence (Text Input)
    - [x] Visibility (Selector)
  - [x] Get Event
    - [x] Calendar ID (Dynamic Selector)
    - [x] Event ID (Text Input)
  - [x] List Events
    - [x] Calendar ID (Dynamic Selector)
    - [x] Time Min (Date and Time Input)
    - [x] Time Max (Date and Time Input)
    - [x] Max Results (Integer Input)
    - [x] Query (Text Input)
    - [x] Single Events (Checkbox Input)
    - [x] Order By (Selector)
  - [x] Update Event
    - [x] Calendar ID (Dynamic Selector)
    - [x] Event ID (Text Field)
    - [x] Summary (Text Field)
    - [x] Description (Text Field)
    - [x] Location (Text Field)
    - [x] Start Time (Date and Time Input)
    - [x] End Time (Date and Time Input)
    - [x] Timezone (Text Field)
    - [x] Attendees (Text Field)
    - [x] Send Notifications (Checkbox Input)
  - [x] Delete Event
    - [x] Calendar ID (Dynamic Selector)
    - [x] Event ID (Text Field)
    - [x] Send Notifications (Checkbox Input)
  - [x] List Calendars
    - [x] Show Hidden (Checkbox Input)
  - [x] Find Free Busy
    - [x] Calendar ID (Dynamic Selector)
    - [x] Time Min (Date and Time Input)
    - [x] Time Max (Date and Time Input)
    - [x] Timezone (Text Input)

#### Gmail (`gmail`)
- **Auth Type**: OAuth 2.0
- **Actions**:
  - [x] Send Email
    - [x] CC (Text Input)
    - [x] To (Text Input)
    - [x] BCC (Text Input)
    - [x] Body (Text Input)
    - [x] Is HTML (Checkbox Input)
    - [x] Subject (Text Input)
  - [x] Read Emails
    - [x] Query (Text Input)
    - [x] Max Results (Integer Input)
  - [x] Get Email
    - [x] Message ID (Text Input)

---

### LLM Connectors

#### Anthropic (`anthropic`)
- **Auth Type**: API Key
- **Actions**:
  - [x] Generate Text
    - [x] Model (Dynamic Selector)
    - [x] Prompt (Text Input)
    - [x] Max Tokens (Text Input)
    - [x] Temperature (Text Input)
    - [x] System Prompt (Text Input)
  - [x] Chat Completion
    - [x] Model (Dynamic Selector)
    - [x] Messages (Text Input)
    - [x] Max Tokens (Text Input)
    - [x] Temperature (Text Input)
    - [x] System Prompt (Text Input)

#### DeepSeek (`deepseek`)
- **Auth Type**: API Key
- **Actions**:
  - [x] Generate Text
    - [x] Model (Dynamic Selector)
    - [x] Prompt (Text Input)
    - [x] Max Tokens (Text Input)
    - [x] Temperature (Text Input)
    - [x] System Prompt (Text Input)
  - [x] Chat Completion
    - [x] Model (Dynamic Selector)
    - [x] Messages (Text Input)
    - [x] Max Tokens (Text Input)
    - [x] Temperature (Text Input)
    - [x] System Prompt (Text Input)

#### Google Gemini (`gemini`)
- **Auth Type**: API Key
- **Actions**:
  - [x] Generate Text
    - [x] Model (Dynamic Selector)
    - [x] Prompt (Text Input)
    - [x] Max Tokens (Text Input)
    - [x] Temperature (Text Input)
    - [x] System Prompt (Text Input)
  - [x] Chat Completion
    - [x] Model (Dynamic Selector)
    - [x] Messages (Text Input)
    - [x] Max Tokens (Text Input)
    - [x] Temperature (Text Input)
    - [x] System Prompt (Text Input)

#### OpenAI (`openai`)
- **Auth Type**: API Key
- **Actions**:
  - [x] Generate Text
    - [x] Model (Dynamic Selector)
    - [x] Prompt (Text Input)
    - [x] Max Tokens (Text Input)
    - [x] Temperature (Text Input)
    - [x] System Prompt (Text Input)
  - [x] Chat Completion
    - [x] Model (Dynamic Selector)
    - [x] Messages (Text Input)
    - [x] Max Tokens (Text Input)
    - [x] Temperature (Text Input)
    - [x] System Prompt (Text Input)

---

### Communication Connectors

#### Slack (`slack`)
- **Auth Type**: OAuth 2.0
- **Actions**:
  - [~] Send Message
    - [x] Text (Text Input)
    - [~] Channel (Text Input -> Dynamic Selector)
    - [x] Blocks (Text Input)
    - [x] Thread Ts (Text Input)
  - [x] List Channels
    - [x] types (Text Input)

---

### HTTP & Webhook Connectors

#### HTTP Request (`http`)
- **Auth Type**: User-defined
- **Actions**:
  - [x] HTTP Request
    - [x] URL (Text Input)
    - [x] Body (Text Input -> Add Body button with rows of headers)
    - [x] Method (Dynamic Selector)
    - [x] Params (Text Input -> Add Param button with rows of headers)
    - [x] Headers (Text Input -> Add Header button with rows of headers)
    - [x] Timeout (Integer Input)

#### Webhook Trigger (`webhook`)
- **Auth Type**: None
- **Actions**:
  - [~] Receive Webhook
    - [x] Path (Disabled Text Field with Copy Button)
    - [x] Respond (Selector)
    - [ ] Raw Body (Checkbox Input)
    - [x] Method (Selector)
    - [ ] Ignore Bots (Checkbox Input)
    - [ ] IP Whitelist (Text Input)
    - [ ] Response Code (Selector)
    - [ ] Response Data (Text Input)
    - [ ] Authentication (Selector)
    - [ ] Allowed Origins (Text Input)
    - [ ] No Response Body (Checkbox Input)
    - [ ] Response Headers (Text Input -> Add Header button with rows of headers)
    - [ ] Field Name Binary Data (Text Input)

---

### Database Connectors

#### Supabase (`supabase`) #NOT IMPLEMENTED
- **Auth Type**: Supabase URL and Publishable Key
- **Actions**:
  - [ ] Database Change

#### Supabase Realtime (`supabase_realtime`)
- **Auth Type**: None
- **Actions**:
  - [ ] Database Change
    - [ ] Event Type (Selector)
    - [ ] Table (Text Input -> Dynamic Selector)
    - [ ] Record (Text Input)
    - [ ] Old Record (Text Input)
    - [ ] Timestamp (Date and Time Input)

---

### Memory Connectors (Agent Resources)

#### MongoDB Memory (`mongodb-memory`)
- **Auth Type**: MongoDB Connection String
- **Actions**:
  - [x] Save Message
    - [x] Role (Selector)
    - [x] Content (Text Input)
    - [x] Metadata (Text Input)
    - [x] Conversation ID (Text Input)
  - [x] Get History
    - [x] Limit (Text Input)
    - [x] Conversation ID (Text Input)
  - [x] Clear History
    - [x] Conversation ID (Text Input)

#### PostgreSQL Memory (`postgres-memory`)
- **Auth Type**: PostgreSQL Connection String (password field)
- **Actions**:
  - [x] Save Message
    - [x] Role (Selector)
    - [x] Content (Text Input)
    - [x] Metadata (Text Input)
    - [x] Conversation ID (Text Input)
  - [x] Get History
    - [x] Limit (Text Input)
    - [x] Conversation ID (Text Input)
  - [x] Clear History
    - [x] Conversation ID (Text Input)

#### Simple Memory (`simple-memory`)
- **Auth Type**: None
- **Actions**:
  - [x] Save Message
    - [x] Role (Selector)
    - [x] Content (Text Input)
    - [x] Metadata (Text Input)
    - [x] Conversation ID (Text Input)
  - [x] Get History
    - [x] Limit (Text Input)
    - [x] Conversation ID (Text Input)
  - [x] Clear History
    - [x] Conversation ID (Text Input)

#### Redis Memory (`redis-memory`)
- **Auth Type**: Redis URL
- **Actions**:
  - [x] Save Message
    - [x] Role (Selector)
    - [x] Content (Text Input)
    - [x] Metadata (Text Input)
    - [x] Conversation ID (Text Input)
  - [x] Get History
    - [x] Limit (Text Input)
    - [x] Conversation ID (Text Input)
  - [x] Clear History
    - [x] Conversation ID (Text Input)

---

### Vector Store Connectors (Agent Resources)

#### MongoDB Atlas Vector (`mongodb-atlas-vector-store`)
- **Auth Type**: MongoDB Atlas Connection String
- **Actions**:
  - [ ] Vector Search
    - [ ] Limit (Text Input)
    - [ ] Index Name (Text Input)
    - [ ] Query Vector (Text Input)
    - [ ] Num Candidates (Integer Input)
  - [ ] Insert Vector
    - [ ] Document (Text Input)
    - [ ] Collection (Text Input)

#### Supabase Vector Store (`supabase-vector-store`)
- **Auth Type**: Supabase URL and Publishable Key
- **Actions**:
  - [ ] Vector Search
    - [ ] Limit (Text Input)
    - [ ] Index Name (Text Input)
    - [ ] Query Vector (Text Input)
    - [ ] Num Candidates (Integer Input)
  - [ ] Insert Vector
    - [ ] Document (Text Input)
    - [ ] Collection (Text Input)

---

### Model Connectors (Agent Resources)

#### OpenAI Model (`openai-model`)
- **Auth Type**: API Key
- **Actions**:
  - [x] Configure Model
    - [x] Model (Dynamic Selector)
    - [x] Max Tokens (Integer Input)
    - [x] Temperature (Float Input)

---

### Tool Connectors (Agent Resources)

#### Code Tool (`code-tool`)
- **Auth Type**: None
- **Actions**:
  - [ ] Execute Python
    - [ ] Code (Text Input)
    - [ ] Timeout (Integer Input)
  - [ ] Execute JavaScript
    - [ ] Code (Text Input)
    - [ ] Timeout (Integer Input)

#### HTTP Tool (`http-tool`)
- **Auth Type**: User-defined
- **Actions**:
  - [x] HTTP Request
    - [x] URL (Text Input)
    - [x] Body (Text Input -> Add Body button with rows of headers)
    - [x] Method (Dynamic Selector)
    - [x] Params (Text Input -> Add Param button with rows of headers)
    - [x] Headers (Text Input -> Add Header button with rows of headers)
    - [x] Timeout (Integer Input)

#### MCP Client (`mcp-client-tool`)
- **Auth Type**: MCP Endpoint (None, Bearer, API Key, Multi-Header)
- **Actions**:
  - [x] Call MCP Tool
    - [x] Arguments (Text Input)
    - [x] Tool Name (Text Input)
  - [x] List MCP Tools

---

### Custom Connectors

#### Custom Connector (`custom-connector`)
- **Auth Type**: User-defined
- **Actions**:
  - [ ] Custom Action

---

## Task Priority & Dependency Chart

 ------------------------------
| TASK | PRIORITY |    DEPS    |
 ------------------------------
|  1   |   HIGH   |   0        |
|  2   |   HIGH   |   1        |
|  3   |   HIGH   |   1        |
|  4   |   MED    |   1        |
|  5   |   HIGH   |   1,3,4    |
|  6   |   MED    |   5        |
|  7   |   MED    |   5        |
|  8   |   HIGH   |   3,5      |
|  9   |   HIGH   |   1,2      |
|  10  |   HIGH   |   1        |
|  11  |   MED    |   5,9,10   |
|  12  |   MED    |   5,9,10   |
|  13  |   MED    |   5,9,10   |
|  14  |   MED    |   5,9,10   |
|  15  |   MED    |   5,9,10   |
|  16  |   MED    |   3,10,15  |
|  17  |   MED    |   5,19     |
|  18  |   HIGH   |   9,16     |
|  19  |   HIGH   |   5,8      |
|  20  |   MED    |   19       |
|  21  |   MED    |   5,8,19   |
|  22  |   HIGH   |   3,10     |
|  23  |   MED    |   10,22    |
|  24  |   MED    |   10,22    |
|  25  |   MED    |   2,22     |
|  26  |   MED    |   9,10,27  |
|  27  |   HIGH   |   5,9      |
|  28  |   HIGH   |   0        |
|  29  |   HIGH   |   28       |
|  30  |   HIGH   |   28       |
|  31  |   HIGH   |   28       |
|  32  |   HIGH   |   30,31    |
|  33  |   HIGH   |   30,31    |
|  34  |   MED    |   30,31    |
|  35  |   MED    |   30,31    |
|  36  |   MED    |   30,31    |
|  37  |   MED    |   30,31    |
|  38  |   MED    |   30,31    |
|  39  |   MED    |   30,31    |
|  40  |   MED    |   30,31    |
|  41  |   MED    |   30,31    |
|  42  |   MED    |   30,31    |
|  43  |   MED    |   30       |
|  44  |   MED    |   33,35    |
|  45  |   MED    |   30       |
|  46  |   MED    |   32,33    |
|  47  |   MED    |   33,34    |
|  48  |   MED    |   30,33    |
|  49  |   HIGH   |   10,11-15 |
|  50  |   HIGH   |   6,14     |
|  51  |   HIGH   |   6,11     |
|  52  |   HIGH   |   10,15    |
|  53  |   HIGH   |   10,22    |
|  54  |   HIGH   |   8,22,33  |
 ------------------------------

---

## Progress Summary

**Status:** 40 done | 4 in progress | 10 pending
**Completion:** 74% (40/54 tasks completed, 4 in progress)

*Note: Task #44 has 3 incomplete sub-items (WebSocket, presence, collaboration). Task #45 has 5/6 sub-items complete (missing error reporting to backend).*

*Note: Tasks marked with `[x]` are done, `[~]` are in progress, and `[ ]` are pending. Run `node taskman/tasks-cli.js` for an interactive progress view.*

