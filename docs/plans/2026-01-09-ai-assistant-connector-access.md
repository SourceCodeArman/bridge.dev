# AI Assistant Connector Access Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable the AI assistant to reference all available connectors and suggest reusing existing workflow nodes by their IDs instead of always creating new ones.

**Architecture:** The AI assistant will receive comprehensive connector context including all available system and custom connectors, plus a mapping of existing nodes in the workflow. The AI can then suggest both reusing existing nodes (by node_id) and adding new ones (by connector_id). The frontend will automatically find referenced nodes and update them with new configurations via manifest.

**Tech Stack:** Django Python backend, React TypeScript frontend, XYFlow for workflow visualization

---

## Task 1: Enhance AssistantService to include existing node context

**Files:**
- Modify: `backend/apps/core/assistant_service.py:50-105`

**Step 1: Add method to extract existing nodes mapping**

The service needs a new method that maps existing workflow nodes by connector ID so the AI can see what's already configured. Add this new method after `build_workflow_context()`:

```python
def get_existing_nodes_mapping(self, workflow: Workflow) -> dict[str, list[dict]]:
    """
    Build a mapping of existing nodes in the workflow by connector ID.

    Returns:
        {
            "connector_id": [
                {
                    "node_id": "uuid",
                    "label": "Node Label",
                    "action_id": "action_name",
                    "type": "trigger|action"
                },
                ...
            ],
            ...
        }
    """
    version = workflow.get_active_version()
    if not version:
        return {}

    definition = version.definition
    nodes = definition.get("nodes", [])

    mapping = {}
    for node in nodes:
        node_data = node.get("data", {})
        connector_id = node_data.get("connector_id", "")

        if connector_id:
            if connector_id not in mapping:
                mapping[connector_id] = []

            mapping[connector_id].append({
                "node_id": node.get("id"),
                "label": node_data.get("label", ""),
                "action_id": node_data.get("action_id", ""),
                "type": node.get("type", "action"),
            })

    return mapping
```

**Step 2: Run tests to verify method works**

Run: `python manage.py test apps.core.tests.test_assistant_service -v 2`

Expected: Tests pass (or create basic test if none exist)

**Step 3: Commit**

```bash
git add backend/apps/core/assistant_service.py
git commit -m "feat(assistant): add method to map existing workflow nodes by connector"
```

---

## Task 2: Update system prompt to include existing nodes context

**Files:**
- Modify: `backend/apps/core/assistant_service.py:107-154`

**Step 1: Update build_system_prompt to include existing nodes**

Modify the `build_system_prompt()` method to include the existing nodes mapping. Change the section that includes workflow context:

```python
def build_system_prompt(
    self,
    workflow: Workflow,
    include_workflow_context: bool = True,
) -> str:
    """Build system prompt with full context."""
    parts = [
        "You are an AI assistant for Bridge.dev, a visual workflow automation platform.",
        "You help users build, configure, and debug workflows through natural conversation.",
        "",
        "Your capabilities:",
        "1. Generate workflow suggestions and modifications",
        "2. Explain node configurations and connector options",
        "3. Debug workflow errors and suggest fixes",
        "4. Answer questions about workflow best practices",
        "",
    ]

    if include_workflow_context:
        parts.append("CURRENT WORKFLOW STATE:")
        parts.append(self.build_workflow_context(workflow))
        parts.append("")

        # Add existing nodes mapping
        existing_nodes = self.get_existing_nodes_mapping(workflow)
        if existing_nodes:
            parts.append("EXISTING NODES BY CONNECTOR:")
            for connector_id, nodes_list in existing_nodes.items():
                parts.append(f"  {connector_id}:")
                for node_info in nodes_list:
                    parts.append(
                        f"    - \"{node_info['label']}\" (id: {node_info['node_id']}, action: {node_info['action_id']})"
                    )
            parts.append("")

    parts.append(self.get_connectors_context())
    parts.append("")

    parts.extend([
        "RESPONSE FORMAT:",
        "Always respond in this JSON format:",
        '{"message": "Your response to the user", "actions": []}',
        "",
        "The 'actions' array can contain structured commands:",
        '- {"type": "add_node", "connector_id": "...", "action_id": "...", "label": "...", "position": {"x": 100, "y": 100}}',
        '- {"type": "update_node", "node_id": "...", "manifest": {...}}',
        '- {"type": "delete_node", "node_id": "..."}',
        '- {"type": "add_edge", "source": "...", "target": "..."}',
        '- {"type": "generate_workflow", "definition": {"nodes": [...], "edges": [...]}}',
        "",
        "WHEN TO REUSE EXISTING NODES:",
        "- If the workflow already has a node of the required connector type (see EXISTING NODES section),",
        "  suggest using that node instead of creating a new one by returning update_node action with node_id",
        "- Only suggest add_node when a new connector type is needed that doesn't exist in the workflow",
        "",
        "If no actions are needed (just answering a question), use: {\"message\": \"...\", \"actions\": []}",
        "",
        "IMPORTANT:",
        "- Always respond with valid JSON only",
        "- Be concise but helpful",
        "- When suggesting changes, explain what you're doing in the message",
        "- Reference nodes by their labels when explaining",
        "- For update_node, include the connector manifest config that matches the user request",
    ])

    return "\n".join(parts)
```

**Step 2: Run tests to verify prompt generation**

Run: `python manage.py test apps.core.tests -v 2 -k "prompt"`

Expected: Tests pass

**Step 3: Commit**

```bash
git add backend/apps/core/assistant_service.py
git commit -m "feat(assistant): add existing nodes mapping to system prompt with reuse guidance"
```

---

## Task 3: Update action types to support node reference by ID

**Files:**
- Modify: `backend/apps/core/assistant_service.py:107-154` (system prompt section only - already done above)
- Modify: `frontend/src/components/workflow/AIAssistantWidget.tsx:31-34`

**Step 1: Update AssistantAction interface to support node references**

In the frontend widget, the action type definition already supports dynamic fields via `[key: string]: any`, so no changes needed there. The interface already allows:
- `node_id` for referencing existing nodes
- `manifest` for configuration data

No code change needed - interface already supports these fields.

**Step 2: Verify assistant widget handles node_id actions**

Check the widget code at `frontend/src/components/workflow/AIAssistantWidget.tsx` - the `handleApplyActions()` callback in WorkflowCanvas should receive these and map them appropriately. This is handled in the next canvas update task.

**Step 3: No commit needed yet**

This task verifies existing structures support the new functionality.

---

## Task 4: Update WorkflowCanvas to handle node references in AI actions

**Files:**
- Modify: `frontend/src/pages/workflow/WorkflowCanvas.tsx` (the handleApplyActions callback)

**Step 1: Read current implementation**

The current `handleApplyActions()` in WorkflowCanvas processes AI-suggested actions. It needs to be enhanced to:
1. Recognize when an action references an existing node by `node_id`
2. Update that node instead of creating a new one
3. Apply the manifest/config from the action to the existing node

**Step 2: Implement node update logic in handleApplyActions**

Update the callback to handle `update_node` actions with manifest data. When an action has type `update_node` with a `node_id`:
- Find the existing node in the nodes array
- Update its `data` properties with the manifest config
- Preserve the node position and connections

Example approach (pseudo-code for reference):

```typescript
case 'update_node': {
    // Handle manifest updates to existing nodes
    const targetNode = nodes.find(n => n.id === action.node_id);
    if (targetNode) {
        const updatedNode = {
            ...targetNode,
            data: {
                ...targetNode.data,
                ...(action.manifest || {}), // Apply manifest config
            },
        };
        // Update nodes array
        setNodes((nds) => nds.map(n => n.id === action.node_id ? updatedNode : n));
    }
    break;
}
```

**Step 3: Test the workflow canvas**

Manually test:
1. Create a workflow with a Slack node
2. Ask AI: "Update the existing Slack node to send a different message"
3. Verify the AI returns `update_node` action with existing node_id
4. Verify the node gets updated without creating a new one

Run: `npm run build` in frontend directory to catch any type errors

**Step 4: Commit**

```bash
git add frontend/src/pages/workflow/WorkflowCanvas.tsx
git commit -m "feat(frontend): support AI-suggested node updates via manifest in workflow canvas"
```

---

## Task 5: Update AI assistant context to include system and custom connectors

**Files:**
- Modify: `backend/apps/core/assistant_service.py:84-105`

**Step 1: Enhance get_connectors_context to fetch all available connectors**

The current `get_connectors_context()` only uses the connector registry. We need to include both system connectors AND custom connectors from the database. Update the method:

```python
def get_connectors_context(self, workspace_id: str = None) -> str:
    """Get available connectors for context (system and custom)."""
    from .models import CustomConnector

    connectors_info = []

    # Include system connectors from registry
    connector_ids = self.connector_registry.list_all()
    for connector_id in connector_ids[:20]:  # Increased from 15 to 20
        try:
            connector_class = self.connector_registry.get(connector_id)
            temp_instance = connector_class({})
            manifest = temp_instance.get_manifest()

            actions = []
            for action in manifest.get("actions", [])[:3]:
                actions.append(f"{action.get('id')}: {action.get('description', action.get('name', ''))}")

            connectors_info.append(
                f"- {manifest.get('name')} (id: {connector_id}): {', '.join(actions)}"
            )
        except Exception as e:
            logger.warning(f"Failed to load connector {connector_id}: {str(e)}")

    # Include custom connectors if workspace_id provided
    if workspace_id:
        try:
            custom_connectors = CustomConnector.objects.filter(
                workspace_id=workspace_id,
                status="active"  # Only active custom connectors
            )[:10]  # Limit to 10 custom connectors

            if custom_connectors.exists():
                connectors_info.append("\nCUSTOM CONNECTORS:")
                for connector in custom_connectors:
                    current_version = connector.current_version_info
                    if current_version:
                        manifest = current_version.get("manifest", {})
                        actions = []
                        for action in manifest.get("actions", [])[:3]:
                            actions.append(f"{action.get('id')}: {action.get('description', action.get('name', ''))}")
                        connectors_info.append(
                            f"- {connector.display_name} (id: {str(connector.id)}, slug: {connector.slug}): {', '.join(actions)}"
                        )
        except Exception as e:
            logger.warning(f"Failed to load custom connectors: {str(e)}")

    return "Available connectors:\n" + "\n".join(connectors_info)
```

**Step 2: Update build_system_prompt to pass workspace_id**

Modify the call to `get_connectors_context()`:

```python
# In build_system_prompt method
# Get workspace from workflow (assuming workflow model has workspace field)
workspace_id = str(workflow.workspace_id) if hasattr(workflow, 'workspace_id') else None
parts.append(self.get_connectors_context(workspace_id=workspace_id))
```

**Step 3: Update chat() and chat_stream() methods**

Both methods call `build_system_prompt()`. No changes needed since we're just passing the workflow which already contains workspace context.

**Step 4: Run tests**

Run: `python manage.py test apps.core.tests.test_assistant_service -v 2`

Expected: Tests pass, no errors loading custom connectors

**Step 5: Commit**

```bash
git add backend/apps/core/assistant_service.py
git commit -m "feat(assistant): include custom connectors in AI context alongside system connectors"
```

---

## Task 6: Test end-to-end AI connector suggestions

**Files:**
- Test: Manual testing via UI

**Step 1: Create a test workflow with mixed connectors**

1. Open Bridge.dev UI
2. Create a new workflow
3. Add a Slack connector node (connector_id: "slack", action: "send_message")
4. Add a Webhook trigger
5. Save the workflow

**Step 2: Test AI reuse suggestion**

Ask the AI: "Add another Slack notification to the workflow"

Expected behavior:
- AI sees existing Slack node in "EXISTING NODES BY CONNECTOR" section
- AI suggests updating the existing Slack node OR explains why a new one is needed
- Returns `update_node` action with the existing node_id
- Frontend updates the node without creating duplicates

**Step 3: Test AI new connector suggestion**

Ask the AI: "Add a Gmail notification to this workflow"

Expected behavior:
- AI sees Gmail in "Available connectors" list
- AI doesn't see any existing Gmail nodes
- AI returns `add_node` action with connector_id: "gmail"
- Frontend creates a new Gmail node

**Step 4: Test custom connector suggestion**

Ask the AI: "Use the Merge connector to combine the outputs"

Expected behavior:
- AI sees custom "Merge" connector in "CUSTOM CONNECTORS" section
- AI returns `add_node` action with connector_id matching the custom connector ID
- Frontend creates a new Merge node

**Step 5: Verify node labels and references**

Check that:
- Node labels in EXISTING NODES section match what's displayed in UI
- Node IDs are correctly referenced in actions
- Manifest data from actions correctly configures nodes

---

## Testing Checklist

- [ ] `get_existing_nodes_mapping()` correctly extracts node information
- [ ] System prompt includes EXISTING NODES section for workflows with nodes
- [ ] System prompt includes CUSTOM CONNECTORS section with workspace connectors
- [ ] AI suggests reusing existing nodes when appropriate
- [ ] AI suggests new nodes only for missing connector types
- [ ] Frontend handles `update_node` actions with manifest data
- [ ] Frontend creates new nodes from `add_node` actions
- [ ] Node IDs in AI responses match actual workflow node IDs
- [ ] Both trigger and action type nodes are included in context
- [ ] Empty workflow (no nodes) doesn't include EXISTING NODES section
- [ ] No errors when custom connectors are unavailable

---

## File Summary

**Backend:**
- `backend/apps/core/assistant_service.py` - Enhanced with node mapping and connector context

**Frontend:**
- `frontend/src/pages/workflow/WorkflowCanvas.tsx` - Updated to handle node updates via manifest

**No database migrations needed** - Uses existing CustomConnector and ChatMessage models
