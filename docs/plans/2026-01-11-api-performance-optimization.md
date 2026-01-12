# API Performance Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce initial page load from ~4-5 seconds to ~800ms-1s by optimizing API endpoints and implementing progressive loading.

**Architecture:** Implement a progressive loading strategy where critical data (workflow graph, lightweight connector list) loads immediately, while non-essential data (full connector manifests, AI assistant history) loads on-demand. Auth context will trust localStorage until token expires, eliminating unnecessary `me/` calls.

**Tech Stack:** Django REST Framework, TanStack Query, React Context, JWT authentication

---

## Task 1: Create ConnectorSummarySerializer for lightweight list

**Files:**
- Modify: `backend/apps/core/serializers.py:41-58`

**Step 1: Add ConnectorSummarySerializer after ConnectorSerializer**

Add this new serializer after the existing `ConnectorSerializer` class (around line 58):

```python
class ConnectorSummarySerializer(serializers.ModelSerializer):
    """Lightweight serializer for connector list - excludes manifest for performance"""

    class Meta:
        model = Connector
        fields = [
            "id",
            "slug",
            "display_name",
            "icon_url_light",
            "icon_url_dark",
        ]
```

**Step 2: Verify file saved correctly**

Run: `python manage.py check`

Expected: System check identified no issues.

**Step 3: Commit**

```bash
git add backend/apps/core/serializers.py
git commit -m "feat(api): add ConnectorSummarySerializer for lightweight connector list"
```

---

## Task 2: Update ConnectorViewSet to use lightweight serializer for list

**Files:**
- Modify: `backend/apps/core/views/connectors.py:19-83`

**Step 1: Import the new serializer**

Update the import statement at line 19-24 to include `ConnectorSummarySerializer`:

```python
from ..serializers import (
    ConnectorSerializer,
    ConnectorSummarySerializer,
    CustomConnectorSerializer,
    CustomConnectorVersionSerializer,
    FormSchemaSerializer,
)
```

**Step 2: Update list method to return lightweight data**

Replace the `list` method (lines 40-83) with this optimized version:

```python
def list(self, request, *args, **kwargs):
    """List all available connectors with minimal data for performance"""
    # Get system connectors with lightweight serializer
    system_connectors = self.get_queryset()
    serializer = ConnectorSummarySerializer(system_connectors, many=True)
    connectors_data = list(serializer.data)

    # Append database-backed custom connectors for this workspace (approved only)
    workspace = getattr(request, "workspace", None)
    if workspace:
        custom_connectors = CustomConnector.objects.filter(
            workspace=workspace,
            status="approved",
            current_version__isnull=False,
            current_version__status="approved",
        ).select_related("current_version")

        for custom in custom_connectors:
            connectors_data.append(
                {
                    "id": custom.slug or str(custom.id),
                    "slug": custom.slug,
                    "display_name": custom.display_name,
                    "icon_url_light": custom.icon_url_light,
                    "icon_url_dark": custom.icon_url_dark,
                    "is_custom": True,
                }
            )

    return Response(
        {
            "status": "success",
            "data": {"connectors": connectors_data, "count": len(connectors_data)},
            "message": "Connectors retrieved successfully",
        }
    )
```

**Step 3: Verify the endpoint works**

Run: `python manage.py runserver` (in one terminal)

Then test: `curl -H "Authorization: Bearer <token>" http://localhost:8000/api/v1/core/connectors/`

Expected: Response with only id, slug, display_name, icon_url_light, icon_url_dark fields (no manifest)

**Step 4: Commit**

```bash
git add backend/apps/core/views/connectors.py
git commit -m "perf(api): return lightweight connector data in list endpoint"
```

---

## Task 3: Add isTokenExpired utility function

**Files:**
- Modify: `frontend/src/lib/utils/storage.ts`

**Step 1: Add JWT token expiry check function**

Add this function at the end of the file (after the `STORAGE_KEYS` export):

```typescript
/**
 * Decode JWT token and check if it's expired.
 * Returns true if token is expired or invalid.
 */
export function isTokenExpired(token: string | null): boolean {
    if (!token) return true;

    try {
        // JWT format: header.payload.signature
        const parts = token.split('.');
        if (parts.length !== 3) return true;

        // Decode payload (base64url)
        const payload = parts[1];
        const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));

        // Check expiry (exp is in seconds, Date.now() is in milliseconds)
        if (!decoded.exp) return true;

        // Add 30 second buffer before actual expiry
        const expiryTime = decoded.exp * 1000;
        return Date.now() >= expiryTime - 30000;
    } catch {
        return true;
    }
}
```

**Step 2: Run type check**

Run: `cd frontend && npm run type-check`

Expected: No type errors

**Step 3: Commit**

```bash
git add frontend/src/lib/utils/storage.ts
git commit -m "feat(auth): add isTokenExpired utility for JWT expiry check"
```

---

## Task 4: Update AuthContext to skip me/ when token is valid

**Files:**
- Modify: `frontend/src/contexts/AuthContext.tsx:1-49`

**Step 1: Import isTokenExpired**

Update the imports at line 3:

```typescript
import { STORAGE_KEYS, getItem, setItem, removeItem, isTokenExpired } from '@/lib/utils/storage';
```

**Step 2: Replace initAuth effect to check token expiry first**

Replace the useEffect block (lines 25-49) with this optimized version:

```typescript
// Check for existing auth on mount
useEffect(() => {
    const initAuth = async () => {
        const token = getItem<string>(STORAGE_KEYS.AUTH_TOKEN);
        const savedUser = getItem<User>(STORAGE_KEYS.USER);

        // If no token, user is not authenticated
        if (!token) {
            setLoading(false);
            return;
        }

        // Check if token is expired
        if (isTokenExpired(token)) {
            // Token expired, clear auth and redirect to login
            removeItem(STORAGE_KEYS.AUTH_TOKEN);
            removeItem(STORAGE_KEYS.REFRESH_TOKEN);
            removeItem(STORAGE_KEYS.USER);
            setUser(null);
            setLoading(false);
            return;
        }

        // Token is valid - use cached user if available
        if (savedUser) {
            setUser(savedUser);
            setLoading(false);
            return;
        }

        // Edge case: valid token but no cached user - fetch from API
        try {
            const currentUser = await authService.getCurrentUser();
            setUser(currentUser);
            setItem(STORAGE_KEYS.USER, currentUser);
        } catch {
            // Token invalid despite not being expired, clear auth
            removeItem(STORAGE_KEYS.AUTH_TOKEN);
            removeItem(STORAGE_KEYS.REFRESH_TOKEN);
            removeItem(STORAGE_KEYS.USER);
            setUser(null);
        }
        setLoading(false);
    };

    initAuth();
}, []);
```

**Step 3: Run type check**

Run: `cd frontend && npm run type-check`

Expected: No type errors

**Step 4: Test auth flow**

Manual test:
1. Login to app
2. Refresh page
3. Check Network tab - `me/` should NOT be called
4. Clear localStorage and refresh - `me/` should redirect to login

**Step 5: Commit**

```bash
git add frontend/src/contexts/AuthContext.tsx
git commit -m "perf(auth): skip me/ API call when JWT token is valid and user cached"
```

---

## Task 5: Move chat history loading to on-demand in AIAssistantWidget

**Files:**
- Modify: `frontend/src/components/workflow/AIAssistantWidget.tsx:68-108`

**Step 1: Update loadChatHistory to be called on expand**

Replace the useEffect for loading history (lines 68-73) and the loadChatHistory function (lines 92-108) with this:

```typescript
// Track if history has been loaded
const [historyLoaded, setHistoryLoaded] = useState(false);

// Load chat history when panel expands (not on mount)
useEffect(() => {
    if (isExpanded && workflowId && !historyLoaded) {
        loadChatHistory();
    }
}, [isExpanded, workflowId, historyLoaded]);
```

And update the loadChatHistory function:

```typescript
const loadChatHistory = async () => {
    if (historyLoaded) return;

    try {
        // Load initial 10 messages for fast render
        const response = await workflowService.getChatHistory(workflowId, 10);
        if (response.data?.messages?.length > 0) {
            const historicalMessages: Message[] = response.data.messages.map((msg: any) => ({
                id: msg.id,
                role: msg.role,
                content: msg.content,
                timestamp: new Date(msg.created_at),
                actions: msg.actions,
            }));
            setMessages(prev => [prev[0], ...historicalMessages]);
        }
        setHistoryLoaded(true);

        // Background prefetch remaining history
        workflowService.getChatHistory(workflowId, 50).then(fullResponse => {
            if (fullResponse.data?.messages?.length > 10) {
                const allMessages: Message[] = fullResponse.data.messages.map((msg: any) => ({
                    id: msg.id,
                    role: msg.role,
                    content: msg.content,
                    timestamp: new Date(msg.created_at),
                    actions: msg.actions,
                }));
                // Replace with full history
                setMessages(prev => [prev[0], ...allMessages]);
            }
        }).catch(console.error);
    } catch (error) {
        console.error('Failed to load chat history:', error);
        setHistoryLoaded(true);
    }
};
```

**Step 2: Run type check**

Run: `cd frontend && npm run type-check`

Expected: No type errors

**Step 3: Commit**

```bash
git add frontend/src/components/workflow/AIAssistantWidget.tsx
git commit -m "perf(assistant): defer chat history loading until panel opens"
```

---

## Task 6: Add offset parameter support to history endpoint

**Files:**
- Modify: `backend/apps/core/views/assistant.py:160-186`

**Step 1: Update get method to support offset**

Replace the get method (lines 160-186) with:

```python
def get(self, request, workflow_id=None):
    workflow = self._get_workflow(workflow_id)
    if not workflow:
        return Response(
            {"status": "error", "message": "Workflow not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        thread = ConversationThread.objects.get(workflow=workflow)
    except ConversationThread.DoesNotExist:
        return Response({
            "status": "success",
            "data": {"thread": None, "messages": []},
        })

    limit = int(request.query_params.get("limit", 50))
    offset = int(request.query_params.get("offset", 0))

    messages = thread.messages.order_by("-created_at")[offset:offset + limit]
    messages = list(reversed(messages))

    return Response({
        "status": "success",
        "data": {
            "thread": ConversationThreadListSerializer(thread).data,
            "messages": ChatMessageSerializer(messages, many=True).data,
            "total": thread.messages.count(),
        },
    })
```

**Step 2: Run tests**

Run: `python manage.py test apps.core.tests -v 2 -k assistant`

Expected: Tests pass

**Step 3: Commit**

```bash
git add backend/apps/core/views/assistant.py
git commit -m "feat(api): add offset parameter to chat history endpoint"
```

---

## Task 7: Standardize connector query keys in frontend

**Files:**
- Modify: `frontend/src/pages/credentials/CredentialsPage.tsx` (find the connectors query)

**Step 1: Find and fix inconsistent query key**

Search for `['connectors', 'list']` in CredentialsPage.tsx and change to `['connectors']`:

```typescript
const { data: connectorsData } = useQuery({
    queryKey: ['connectors'],  // Changed from ['connectors', 'list']
    queryFn: () => connectorService.list()
});
```

**Step 2: Add staleTime to connector queries in WorkflowCanvas.tsx**

Update the connector queries (around lines 191-199) to add staleTime:

```typescript
// Fetch available connectors
const { data: connectors } = useQuery({
    queryKey: ['connectors'],
    queryFn: connectorService.list,
    staleTime: Infinity,  // Cache until invalidated
});

const { data: customConnectors } = useQuery({
    queryKey: ['custom-connectors'],
    queryFn: customConnectorService.list,
    staleTime: Infinity,  // Cache until invalidated
});
```

**Step 3: Add staleTime to ConnectorsPage.tsx**

Update the queries in ConnectorsPage.tsx:

```typescript
const { data: connectors, isLoading, error } = useQuery({
    queryKey: ['connectors'],
    queryFn: connectorService.list,
    staleTime: Infinity,
});

const { data: customConnectors, isLoading: isCustomLoading, error: customError } = useQuery({
    queryKey: ['custom-connectors'],
    queryFn: customConnectorService.list,
    staleTime: Infinity,
});
```

**Step 4: Run type check**

Run: `cd frontend && npm run type-check`

Expected: No type errors

**Step 5: Commit**

```bash
git add frontend/src/pages/credentials/CredentialsPage.tsx frontend/src/pages/workflow/WorkflowCanvas.tsx frontend/src/pages/connectors/ConnectorsPage.tsx
git commit -m "perf(frontend): standardize query keys and add staleTime for connectors"
```

---

## Task 8: Add cache invalidation for custom connector mutations

**Files:**
- Modify: `frontend/src/pages/connectors/ConnectorsPage.tsx`

**Step 1: Add invalidation on custom connector create/update/delete**

Find where custom connector mutations are called and add invalidation. Add this hook usage near other useQuery calls:

```typescript
const queryClient = useQueryClient();

// After any custom connector mutation (create, update, delete), add:
queryClient.invalidateQueries({ queryKey: ['connectors'] });
queryClient.invalidateQueries({ queryKey: ['custom-connectors'] });
```

If there's a mutation hook for custom connectors, update it to include onSuccess:

```typescript
const createCustomConnector = useMutation({
    mutationFn: customConnectorService.create,
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['connectors'] });
        queryClient.invalidateQueries({ queryKey: ['custom-connectors'] });
    },
});
```

**Step 2: Verify mutations exist and add invalidation**

Check if the page has create/update/delete handlers and ensure they invalidate the cache.

**Step 3: Run type check**

Run: `cd frontend && npm run type-check`

Expected: No type errors

**Step 4: Commit**

```bash
git add frontend/src/pages/connectors/ConnectorsPage.tsx
git commit -m "perf(frontend): invalidate connector cache on custom connector mutations"
```

---

## Task 9: Update frontend connector service for new response format

**Files:**
- Modify: `frontend/src/lib/api/services/connector.ts`

**Step 1: Update list method to handle lightweight response**

The list method should work as-is since it already handles the response format, but verify the type interface includes the minimal fields:

```typescript
// In frontend/src/types/index.ts or connector types file
export interface ConnectorSummary {
    id: string;
    slug: string;
    display_name: string;
    icon_url_light?: string;
    icon_url_dark?: string;
    is_custom?: boolean;
}
```

**Step 2: Add getManifest method for fetching full connector details**

Add this method to connectorService:

```typescript
getManifest: async (id: string): Promise<Connector> => {
    const response = await apiClient.get<any>(API_ENDPOINTS.CONNECTORS.DETAIL(id));
    const data = response.data;

    // Handle wrapped response format
    if (data.data && typeof data.data === 'object' && 'id' in data.data) {
        return data.data;
    }

    return data;
},
```

**Step 3: Run type check**

Run: `cd frontend && npm run type-check`

Expected: No type errors

**Step 4: Commit**

```bash
git add frontend/src/lib/api/services/connector.ts
git commit -m "feat(frontend): add getManifest method for on-demand connector details"
```

---

## Task 10: Add workflow query caching with staleTime

**Files:**
- Modify: `frontend/src/pages/workflow/WorkflowCanvas.tsx:125-129`

**Step 1: Add staleTime to workflow query**

Update the workflow query:

```typescript
// Fetch workflow data if ID is present
const { data: workflow } = useQuery({
    queryKey: ['workflow', id],
    queryFn: () => workflowService.get(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,  // 5 minutes
});
```

**Step 2: Run type check**

Run: `cd frontend && npm run type-check`

Expected: No type errors

**Step 3: Commit**

```bash
git add frontend/src/pages/workflow/WorkflowCanvas.tsx
git commit -m "perf(frontend): add 5-minute staleTime to workflow query"
```

---

## Task 11: Verify no unnecessary drafts/ call on initial load

**Files:**
- Review: `frontend/src/pages/workflow/WorkflowCanvas.tsx`

**Step 1: Search for getDraft calls**

Verify that `workflowService.getDraft()` is not called on initial mount. The workflow data (including current_version with graph) should come from the `workflow/{id}/` response.

Search for any `getDraft` calls in the file. If found on initial load, remove them.

**Step 2: Verify the workflow query returns current_version**

Check that the workflow query response includes `current_version.graph` (alias for `definition`). The hydration effect (lines 137-171) uses `workflow?.current_version?.graph` which should work.

**Step 3: Document finding**

If no unnecessary getDraft call exists, document that it's already correct:

```bash
git commit --allow-empty -m "verify(frontend): no unnecessary drafts/ call on initial load"
```

---

## Testing Checklist

- [ ] `me/` endpoint is NOT called when valid token exists in localStorage
- [ ] `connectors/` endpoint returns ~3KB instead of 67KB (no manifests)
- [ ] `connectors/{id}/` endpoint returns full manifest when accessed
- [ ] Chat history loads only when AI assistant panel opens
- [ ] Initial 10 messages load fast, remaining prefetch in background
- [ ] Query keys are consistent across all pages (`['connectors']`)
- [ ] Connector cache is invalidated when custom connector is created/updated/deleted
- [ ] Workflow canvas loads with only 2 parallel requests initially
- [ ] Total initial load time reduced from ~4-5s to ~800ms-1s

---

## File Summary

**Backend:**
- `backend/apps/core/serializers.py` - Added ConnectorSummarySerializer
- `backend/apps/core/views/connectors.py` - Updated list to use lightweight serializer
- `backend/apps/core/views/assistant.py` - Added offset parameter to history endpoint

**Frontend:**
- `frontend/src/lib/utils/storage.ts` - Added isTokenExpired utility
- `frontend/src/contexts/AuthContext.tsx` - Skip me/ when token valid
- `frontend/src/components/workflow/AIAssistantWidget.tsx` - Defer history loading
- `frontend/src/lib/api/services/connector.ts` - Added getManifest method
- `frontend/src/pages/workflow/WorkflowCanvas.tsx` - Added staleTime, standardized queries
- `frontend/src/pages/connectors/ConnectorsPage.tsx` - Standardized queries, cache invalidation
- `frontend/src/pages/credentials/CredentialsPage.tsx` - Fixed query key

**No database migrations needed** - Only serializer and view logic changes
