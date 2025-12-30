# bridge.dev [![wakatime](https://wakatime.com/badge/user/4a2c04a0-e17f-4c55-8202-8dcc0ed8e240/project/08799c74-8fbb-412f-b361-4eb2e83d8c33.svg)](https://wakatime.com/badge/user/4a2c04a0-e17f-4c55-8202-8dcc0ed8e240/project/08799c74-8fbb-412f-b361-4eb2e83d8c33)

Bridge.dev is an open, self-hostable automation platform for visual workflows without SaaS lock-in. Build flows on a drag-and-drop canvas, get AI suggestions, orchestrate triggers, retries, and alerts, run on your own infra and keys, extend via a connector SDK, and collaborate securely.

## User-Contributed Nodes (Custom Connectors)

Bridge.dev supports user-contributed nodes via **custom connectors**:

- Custom connectors are stored in the `CustomConnector` and `CustomConnectorVersion` models.
- Manifests are validated against the same JSON schema as built-in connectors.
- Approved connector versions can be managed via the API:
  - `GET /api/v1/core/custom-connectors/`
  - `POST /api/v1/core/custom-connectors/`
  - `GET /api/v1/core/custom-connector-versions/`
  - `POST /api/v1/core/custom-connector-versions/`
  - `POST /api/v1/core/custom-connector-versions/{id}/submit_for_review/`
  - `POST /api/v1/core/custom-connector-versions/{id}/approve/`
  - `POST /api/v1/core/custom-connector-versions/{id}/reject/`

Execution of approved custom connectors is routed through the sandbox executor to
ensure isolation and apply network/secret policies. For now, the runtime behaviour
is a safe placeholder that echoes inputs, and can be extended to call user-defined
logic in the future.

