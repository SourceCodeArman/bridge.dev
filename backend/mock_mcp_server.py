#!/usr/bin/env python3
"""
Mock MCP Server - A demonstration MCP server built with FastMCP.

This server provides mock tools for user management, task management,
and data operations. It demonstrates multiple authentication methods:
- None (public endpoints)
- Bearer token
- Custom header
- MCP OAuth2
- Multiple headers

Usage:
    # Run with stdio transport (default, for local tools)
    python mock_mcp_server.py

    # Run with HTTP transport (for remote access)
    python mock_mcp_server.py --http --port 8000

    # Test with MCP Inspector
    npx @modelcontextprotocol/inspector python mock_mcp_server.py

Bridge.dev MCP Client Tool OAuth Configuration:
    When creating an MCP OAuth credential in Bridge.dev, use these values:

    Client ID:         mock_mcp_client_id_12345
    Client Secret:     mock_mcp_client_secret_67890
    Authorization URL: http://localhost:8000/mcp/oauth/authorize
    Token URL:         http://localhost:8000/mcp/oauth/token
    Scope:             read write admin
    Server URL:        http://localhost:8000
    Allowed Domains:   localhost,127.0.0.1,*.example.com

    Demo Access Tokens (for testing):
    - oauth2_demo_token (scopes: read, write, admin)
    - oauth2_access_token_xyz (scopes: read, write)
"""

import argparse
import hashlib
import json
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

from mcp.server.fastmcp import Context, FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import BaseModel, ConfigDict, Field, field_validator

# =============================================================================
# Configuration and Constants
# =============================================================================

SERVER_NAME = "mock_mcp"
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

# =============================================================================
# Authentication Configuration
# =============================================================================


class AuthMethod(str, Enum):
    """Supported authentication methods."""

    NONE = "none"
    BEARER = "bearer"
    HEADER = "header"
    OAUTH2 = "oauth2"
    MULTI_HEADER = "multi_header"


# Mock API keys and tokens for demonstration
VALID_BEARER_TOKENS = {
    "mock_bearer_token_12345": {"user_id": "user_001", "scope": "read:write"},
    "mock_bearer_token_67890": {"user_id": "user_002", "scope": "read"},
    "demo_token": {"user_id": "user_001", "scope": "read:write"},
}

VALID_API_KEYS = {
    "mock_api_key_abcdef": {"user_id": "user_001", "tier": "premium"},
    "mock_api_key_ghijkl": {"user_id": "user_002", "tier": "basic"},
    "demo_key": {"user_id": "user_001", "tier": "premium"},
}

# OAuth2 configuration - Compatible with Bridge.dev MCP Client Tool OAuth modal
OAUTH2_CONFIG = {
    "client_id": "mock_mcp_client_id_12345",
    "client_secret": "mock_mcp_client_secret_67890",
    "authorization_url": "http://localhost:8000/mcp/oauth/authorize",
    "token_url": "http://localhost:8000/mcp/oauth/token",
    "scope": "read write admin",  # Space-separated scopes for OAuth modal
    "server_url": "http://localhost:8000",
    "allowed_domains": "localhost,127.0.0.1,*.example.com",
}

# Mock OAuth2 tokens (in production, these would be validated against an auth server)
VALID_OAUTH2_TOKENS = {
    "oauth2_access_token_xyz": {
        "user_id": "user_001",
        "scopes": ["read", "write"],
        "expires_at": time.time() + 3600,
    },
    "oauth2_demo_token": {
        "user_id": "user_001",
        "scopes": ["read", "write", "admin"],
        "expires_at": time.time() + 3600,
    },
}

# Multi-header auth configuration
MULTI_HEADER_CONFIG = {
    "required_headers": ["X-API-Key", "X-Client-ID", "X-Timestamp"],
    "valid_combinations": {
        ("demo_key", "client_001"): {"user_id": "user_001", "permissions": ["all"]},
        ("demo_key", "client_002"): {"user_id": "user_002", "permissions": ["read"]},
    },
}

# Store for current auth context (simulates request context)
_current_auth_context: Dict[str, Any] = {}

# Mock data store (simulates a database)
MOCK_USERS: Dict[str, Dict[str, Any]] = {
    "user_001": {
        "id": "user_001",
        "name": "Alice Johnson",
        "email": "alice@example.com",
        "role": "admin",
        "created_at": "2024-01-15T10:30:00Z",
        "status": "active",
    },
    "user_002": {
        "id": "user_002",
        "name": "Bob Smith",
        "email": "bob@example.com",
        "role": "developer",
        "created_at": "2024-02-20T14:45:00Z",
        "status": "active",
    },
    "user_003": {
        "id": "user_003",
        "name": "Carol Williams",
        "email": "carol@example.com",
        "role": "designer",
        "created_at": "2024-03-10T09:15:00Z",
        "status": "inactive",
    },
}

MOCK_TASKS: Dict[str, Dict[str, Any]] = {
    "task_001": {
        "id": "task_001",
        "title": "Implement user authentication",
        "description": "Add OAuth2 authentication flow to the API",
        "status": "in_progress",
        "priority": "high",
        "assignee_id": "user_002",
        "created_at": "2024-06-01T08:00:00Z",
        "due_date": "2024-06-15T17:00:00Z",
        "tags": ["backend", "security"],
    },
    "task_002": {
        "id": "task_002",
        "title": "Design new dashboard",
        "description": "Create mockups for the analytics dashboard",
        "status": "todo",
        "priority": "medium",
        "assignee_id": "user_003",
        "created_at": "2024-06-02T10:30:00Z",
        "due_date": "2024-06-20T17:00:00Z",
        "tags": ["design", "frontend"],
    },
    "task_003": {
        "id": "task_003",
        "title": "Write API documentation",
        "description": "Document all REST API endpoints",
        "status": "done",
        "priority": "low",
        "assignee_id": "user_001",
        "created_at": "2024-05-15T11:00:00Z",
        "due_date": "2024-05-30T17:00:00Z",
        "tags": ["documentation"],
    },
}


# =============================================================================
# Enums and Constants
# =============================================================================


class ResponseFormat(str, Enum):
    """Output format for tool responses."""

    MARKDOWN = "markdown"
    JSON = "json"


class TaskStatus(str, Enum):
    """Status values for tasks."""

    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    CANCELLED = "cancelled"


class TaskPriority(str, Enum):
    """Priority values for tasks."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class UserRole(str, Enum):
    """Role values for users."""

    ADMIN = "admin"
    DEVELOPER = "developer"
    DESIGNER = "designer"
    VIEWER = "viewer"


# =============================================================================
# Pydantic Input Models
# =============================================================================


class ListUsersInput(BaseModel):
    """Input model for listing users."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    limit: int = Field(
        default=DEFAULT_PAGE_SIZE,
        description="Maximum number of users to return (1-100)",
        ge=1,
        le=MAX_PAGE_SIZE,
    )
    offset: int = Field(
        default=0, description="Number of users to skip for pagination", ge=0
    )
    role: Optional[UserRole] = Field(default=None, description="Filter users by role")
    status: Optional[str] = Field(
        default=None, description="Filter by status ('active' or 'inactive')"
    )
    response_format: ResponseFormat = Field(
        default=ResponseFormat.MARKDOWN,
        description="Output format: 'markdown' for human-readable or 'json' for machine-readable",
    )


class GetUserInput(BaseModel):
    """Input model for getting a single user."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    user_id: str = Field(
        ...,
        description="The unique identifier of the user (e.g., 'user_001')",
        min_length=1,
        max_length=50,
    )
    response_format: ResponseFormat = Field(
        default=ResponseFormat.MARKDOWN,
        description="Output format: 'markdown' or 'json'",
    )


class CreateUserInput(BaseModel):
    """Input model for creating a new user."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(
        ..., description="Full name of the user", min_length=1, max_length=100
    )
    email: str = Field(
        ...,
        description="Email address of the user",
        pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$",
    )
    role: UserRole = Field(
        default=UserRole.VIEWER, description="Role to assign to the user"
    )

    @field_validator("email")
    @classmethod
    def validate_email_lowercase(cls, v: str) -> str:
        """Normalize email to lowercase."""
        return v.lower().strip()


class ListTasksInput(BaseModel):
    """Input model for listing tasks."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    limit: int = Field(
        default=DEFAULT_PAGE_SIZE,
        description="Maximum number of tasks to return (1-100)",
        ge=1,
        le=MAX_PAGE_SIZE,
    )
    offset: int = Field(
        default=0, description="Number of tasks to skip for pagination", ge=0
    )
    status: Optional[TaskStatus] = Field(
        default=None, description="Filter tasks by status"
    )
    priority: Optional[TaskPriority] = Field(
        default=None, description="Filter tasks by priority"
    )
    assignee_id: Optional[str] = Field(
        default=None, description="Filter tasks by assignee user ID"
    )
    tag: Optional[str] = Field(
        default=None, description="Filter tasks that have this tag"
    )
    response_format: ResponseFormat = Field(
        default=ResponseFormat.MARKDOWN,
        description="Output format: 'markdown' or 'json'",
    )


class GetTaskInput(BaseModel):
    """Input model for getting a single task."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    task_id: str = Field(
        ...,
        description="The unique identifier of the task (e.g., 'task_001')",
        min_length=1,
        max_length=50,
    )
    response_format: ResponseFormat = Field(
        default=ResponseFormat.MARKDOWN,
        description="Output format: 'markdown' or 'json'",
    )


class CreateTaskInput(BaseModel):
    """Input model for creating a new task."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    title: str = Field(
        ..., description="Title of the task", min_length=1, max_length=200
    )
    description: Optional[str] = Field(
        default=None, description="Detailed description of the task", max_length=2000
    )
    priority: TaskPriority = Field(
        default=TaskPriority.MEDIUM, description="Priority level of the task"
    )
    assignee_id: Optional[str] = Field(
        default=None, description="User ID to assign the task to"
    )
    tags: List[str] = Field(
        default_factory=list, description="Tags to categorize the task", max_length=10
    )
    due_date: Optional[str] = Field(
        default=None,
        description="Due date in ISO format (e.g., '2024-12-31T17:00:00Z')",
    )


class UpdateTaskInput(BaseModel):
    """Input model for updating a task."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    task_id: str = Field(
        ...,
        description="The unique identifier of the task to update",
        min_length=1,
        max_length=50,
    )
    title: Optional[str] = Field(
        default=None, description="New title for the task", min_length=1, max_length=200
    )
    description: Optional[str] = Field(
        default=None, description="New description for the task", max_length=2000
    )
    status: Optional[TaskStatus] = Field(
        default=None, description="New status for the task"
    )
    priority: Optional[TaskPriority] = Field(
        default=None, description="New priority for the task"
    )
    assignee_id: Optional[str] = Field(
        default=None, description="New assignee for the task"
    )


class SearchInput(BaseModel):
    """Input model for searching across resources."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    query: str = Field(
        ..., description="Search query string", min_length=1, max_length=200
    )
    resource_type: Optional[str] = Field(
        default=None,
        description="Limit search to specific resource type ('users' or 'tasks')",
    )
    limit: int = Field(default=10, description="Maximum results to return", ge=1, le=50)
    response_format: ResponseFormat = Field(
        default=ResponseFormat.MARKDOWN,
        description="Output format: 'markdown' or 'json'",
    )


# =============================================================================
# Authentication Input Models
# =============================================================================


class PublicDataInput(BaseModel):
    """Input model for public (no-auth) endpoints."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    include_metadata: bool = Field(
        default=False, description="Include additional metadata in response"
    )
    response_format: ResponseFormat = Field(
        default=ResponseFormat.JSON, description="Output format: 'markdown' or 'json'"
    )


class BearerAuthInput(BaseModel):
    """Input model for Bearer token authenticated endpoints."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    bearer_token: str = Field(
        ...,
        description="Bearer token for authentication (e.g., 'demo_token'). Valid tokens: demo_token, mock_bearer_token_12345, mock_bearer_token_67890",
        min_length=1,
    )
    resource_id: Optional[str] = Field(
        default=None, description="Optional resource ID to fetch specific data"
    )
    response_format: ResponseFormat = Field(
        default=ResponseFormat.JSON, description="Output format"
    )


class HeaderAuthInput(BaseModel):
    """Input model for custom header (API key) authenticated endpoints."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    api_key: str = Field(
        ...,
        description="API key for authentication (e.g., 'demo_key'). Valid keys: demo_key, mock_api_key_abcdef, mock_api_key_ghijkl",
        min_length=1,
    )
    action: str = Field(
        default="list", description="Action to perform: 'list', 'get', 'create'"
    )
    data: Optional[Dict[str, Any]] = Field(
        default=None, description="Additional data for create actions"
    )
    response_format: ResponseFormat = Field(
        default=ResponseFormat.JSON, description="Output format"
    )


class OAuth2AuthInput(BaseModel):
    """Input model for OAuth2 authenticated endpoints."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    access_token: str = Field(
        ...,
        description="OAuth2 access token (e.g., 'oauth2_demo_token'). Valid tokens: oauth2_demo_token, oauth2_access_token_xyz",
        min_length=1,
    )
    required_scopes: Optional[List[str]] = Field(
        default=None,
        description="Scopes required for this operation (e.g., ['read', 'write']). Available scopes: read, write, admin",
    )
    resource_type: str = Field(
        default="users",
        description="Resource type to access: 'users', 'tasks', 'settings'",
    )
    operation: str = Field(
        default="read", description="Operation to perform: 'read', 'write', 'delete'"
    )
    response_format: ResponseFormat = Field(
        default=ResponseFormat.JSON, description="Output format"
    )


class MultiHeaderAuthInput(BaseModel):
    """Input model for multi-header authenticated endpoints."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    api_key: str = Field(
        ..., description="API key header value (e.g., 'demo_key')", min_length=1
    )
    client_id: str = Field(
        ...,
        description="Client ID header value (e.g., 'client_001'). Valid with demo_key: client_001, client_002",
        min_length=1,
    )
    timestamp: Optional[str] = Field(
        default=None,
        description="Request timestamp (Unix epoch). If not provided, current time will be used",
    )
    signature: Optional[str] = Field(
        default=None, description="Optional HMAC signature for request verification"
    )
    action: str = Field(
        default="verify",
        description="Action: 'verify' (check auth), 'fetch' (get data), 'submit' (send data)",
    )
    payload: Optional[Dict[str, Any]] = Field(
        default=None, description="Payload data for submit actions"
    )
    response_format: ResponseFormat = Field(
        default=ResponseFormat.JSON, description="Output format"
    )


class AuthInfoInput(BaseModel):
    """Input model for getting authentication method information."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    auth_method: Optional[AuthMethod] = Field(
        default=None,
        description="Specific auth method to get info for. If not provided, returns info for all methods.",
    )
    include_demo_credentials: bool = Field(
        default=True, description="Include demo credentials in the response"
    )


# =============================================================================
# Helper Functions
# =============================================================================


def format_user_markdown(user: Dict[str, Any]) -> str:
    """Format a user as markdown."""
    return f"""### {user["name"]}
- **ID**: {user["id"]}
- **Email**: {user["email"]}
- **Role**: {user["role"]}
- **Status**: {user["status"]}
- **Created**: {user["created_at"]}"""


def format_task_markdown(task: Dict[str, Any]) -> str:
    """Format a task as markdown."""
    assignee = MOCK_USERS.get(task["assignee_id"], {}).get("name", "Unassigned")
    tags_str = ", ".join(task.get("tags", [])) or "None"
    return f"""### {task["title"]}
- **ID**: {task["id"]}
- **Status**: {task["status"]}
- **Priority**: {task["priority"]}
- **Assignee**: {assignee} ({task["assignee_id"]})
- **Due**: {task.get("due_date", "No due date")}
- **Tags**: {tags_str}
- **Description**: {task.get("description", "No description")}"""


def paginate_results(items: List[Any], offset: int, limit: int) -> Dict[str, Any]:
    """Apply pagination to a list of items."""
    total = len(items)
    paginated = items[offset : offset + limit]
    return {
        "items": paginated,
        "total": total,
        "offset": offset,
        "limit": limit,
        "count": len(paginated),
        "has_more": total > offset + len(paginated),
        "next_offset": offset + len(paginated)
        if total > offset + len(paginated)
        else None,
    }


def handle_error(error_type: str, message: str, suggestion: str = "") -> str:
    """Generate a consistent error response."""
    error = {
        "error": True,
        "type": error_type,
        "message": message,
        "suggestion": suggestion,
    }
    return json.dumps(error, indent=2)


def generate_id(prefix: str) -> str:
    """Generate a new unique ID."""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"{prefix}_{timestamp}"


# =============================================================================
# Authentication Helper Functions
# =============================================================================


def validate_no_auth() -> Tuple[bool, Optional[str], Dict[str, Any]]:
    """
    Validate public/no-auth endpoints.
    Always succeeds - used for public endpoints.

    Returns:
        Tuple of (is_valid, error_message, auth_context)
    """
    return True, None, {"auth_method": "none", "authenticated": False}


def validate_bearer_token(
    token: Optional[str],
) -> Tuple[bool, Optional[str], Dict[str, Any]]:
    """
    Validate Bearer token authentication.

    Args:
        token: The bearer token (with or without 'Bearer ' prefix)

    Returns:
        Tuple of (is_valid, error_message, auth_context)
    """
    if not token:
        return (
            False,
            "Bearer token is required. Provide via 'Authorization: Bearer <token>'",
            {},
        )

    # Strip 'Bearer ' prefix if present
    if token.startswith("Bearer "):
        token = token[7:]

    token_data = VALID_BEARER_TOKENS.get(token)
    if not token_data:
        return (
            False,
            f"Invalid bearer token. Valid demo tokens: {list(VALID_BEARER_TOKENS.keys())}",
            {},
        )

    return (
        True,
        None,
        {
            "auth_method": "bearer",
            "authenticated": True,
            "user_id": token_data["user_id"],
            "scope": token_data["scope"],
            "token": token[:10] + "...",  # Masked token for logging
        },
    )


def validate_header_auth(
    api_key: Optional[str],
) -> Tuple[bool, Optional[str], Dict[str, Any]]:
    """
    Validate custom header (API key) authentication.

    Args:
        api_key: The API key from X-API-Key header

    Returns:
        Tuple of (is_valid, error_message, auth_context)
    """
    if not api_key:
        return False, "API key is required. Provide via 'X-API-Key: <key>' header", {}

    key_data = VALID_API_KEYS.get(api_key)
    if not key_data:
        return (
            False,
            f"Invalid API key. Valid demo keys: {list(VALID_API_KEYS.keys())}",
            {},
        )

    return (
        True,
        None,
        {
            "auth_method": "header",
            "authenticated": True,
            "user_id": key_data["user_id"],
            "tier": key_data["tier"],
            "api_key": api_key[:10] + "...",  # Masked key for logging
        },
    )


def validate_oauth2_token(
    access_token: Optional[str], required_scopes: Optional[List[str]] = None
) -> Tuple[bool, Optional[str], Dict[str, Any]]:
    """
    Validate OAuth2 access token.

    Args:
        access_token: The OAuth2 access token
        required_scopes: List of scopes required for this operation

    Returns:
        Tuple of (is_valid, error_message, auth_context)
    """
    if not access_token:
        return (
            False,
            (
                "OAuth2 access token is required. "
                f"Authorize at: {OAUTH2_CONFIG['authorization_url']} "
                f"with client_id: {OAUTH2_CONFIG['client_id']}"
            ),
            {},
        )

    # Strip 'Bearer ' prefix if present
    if access_token.startswith("Bearer "):
        access_token = access_token[7:]

    token_data = VALID_OAUTH2_TOKENS.get(access_token)
    if not token_data:
        return (
            False,
            f"Invalid OAuth2 token. Valid demo tokens: {list(VALID_OAUTH2_TOKENS.keys())}",
            {},
        )

    # Check token expiration
    if token_data.get("expires_at", 0) < time.time():
        return False, "OAuth2 token has expired. Please refresh your token.", {}

    # Check required scopes
    if required_scopes:
        token_scopes = set(token_data.get("scopes", []))
        missing_scopes = set(required_scopes) - token_scopes
        if missing_scopes:
            return (
                False,
                (
                    f"Insufficient scopes. Required: {required_scopes}, "
                    f"Token has: {list(token_scopes)}, Missing: {list(missing_scopes)}"
                ),
                {},
            )

    return (
        True,
        None,
        {
            "auth_method": "oauth2",
            "authenticated": True,
            "user_id": token_data["user_id"],
            "scopes": token_data["scopes"],
            "expires_at": datetime.fromtimestamp(
                token_data["expires_at"], tz=timezone.utc
            ).isoformat(),
        },
    )


def validate_multi_header_auth(
    api_key: Optional[str],
    client_id: Optional[str],
    timestamp: Optional[str],
    signature: Optional[str] = None,
) -> Tuple[bool, Optional[str], Dict[str, Any]]:
    """
    Validate multi-header authentication.
    Requires multiple headers to be present and valid.

    Args:
        api_key: The API key from X-API-Key header
        client_id: The client ID from X-Client-ID header
        timestamp: Request timestamp from X-Timestamp header
        signature: Optional HMAC signature from X-Signature header

    Returns:
        Tuple of (is_valid, error_message, auth_context)
    """
    # Check required headers
    missing_headers = []
    if not api_key:
        missing_headers.append("X-API-Key")
    if not client_id:
        missing_headers.append("X-Client-ID")
    if not timestamp:
        missing_headers.append("X-Timestamp")

    if missing_headers:
        return (
            False,
            (
                f"Missing required headers: {missing_headers}. "
                f"Required headers: {MULTI_HEADER_CONFIG['required_headers']}"
            ),
            {},
        )

    # Validate timestamp (must be within 5 minutes)
    try:
        request_time = int(timestamp)
        current_time = int(time.time())
        if abs(current_time - request_time) > 300:  # 5 minutes
            return (
                False,
                "Request timestamp is too old or in the future (must be within 5 minutes)",
                {},
            )
    except ValueError:
        return False, "Invalid timestamp format. Must be Unix epoch seconds.", {}

    # Validate API key + client ID combination
    combo = (api_key, client_id)
    combo_data = MULTI_HEADER_CONFIG["valid_combinations"].get(combo)
    if not combo_data:
        return (
            False,
            (
                f"Invalid API key + client ID combination. "
                f"Valid demo combinations: {list(MULTI_HEADER_CONFIG['valid_combinations'].keys())}"
            ),
            {},
        )

    # Optional: Validate signature if provided
    if signature:
        # In production, verify HMAC signature here
        hashlib.sha256(f"{api_key}:{client_id}:{timestamp}".encode()).hexdigest()[:16]
        # For demo purposes, we accept any signature

    return (
        True,
        None,
        {
            "auth_method": "multi_header",
            "authenticated": True,
            "user_id": combo_data["user_id"],
            "client_id": client_id,
            "permissions": combo_data["permissions"],
            "request_timestamp": timestamp,
        },
    )


def format_auth_error(auth_method: AuthMethod, error_message: str) -> str:
    """Format authentication error with helpful information."""
    error = {
        "error": True,
        "type": "authentication_error",
        "auth_method": auth_method.value,
        "message": error_message,
        "help": get_auth_help(auth_method),
    }
    return json.dumps(error, indent=2)


def get_auth_help(auth_method: AuthMethod) -> Dict[str, Any]:
    """Get help information for an authentication method."""
    if auth_method == AuthMethod.NONE:
        return {"description": "No authentication required for this endpoint"}

    elif auth_method == AuthMethod.BEARER:
        return {
            "description": "Bearer token authentication",
            "header": "Authorization: Bearer <token>",
            "demo_tokens": list(VALID_BEARER_TOKENS.keys()),
            "example": "Authorization: Bearer demo_token",
        }

    elif auth_method == AuthMethod.HEADER:
        return {
            "description": "API key header authentication",
            "header": "X-API-Key: <api_key>",
            "demo_keys": list(VALID_API_KEYS.keys()),
            "example": "X-API-Key: demo_key",
        }

    elif auth_method == AuthMethod.OAUTH2:
        return {
            "description": "OAuth2 authentication",
            "authorization_url": OAUTH2_CONFIG["authorization_url"],
            "token_url": OAUTH2_CONFIG["token_url"],
            "client_id": OAUTH2_CONFIG["client_id"],
            "client_secret": OAUTH2_CONFIG["client_secret"],
            "scope": OAUTH2_CONFIG["scope"],
            "server_url": OAUTH2_CONFIG["server_url"],
            "allowed_domains": OAUTH2_CONFIG["allowed_domains"],
            "demo_tokens": list(VALID_OAUTH2_TOKENS.keys()),
            "example": "Authorization: Bearer oauth2_demo_token",
        }

    elif auth_method == AuthMethod.MULTI_HEADER:
        return {
            "description": "Multi-header authentication",
            "required_headers": MULTI_HEADER_CONFIG["required_headers"],
            "demo_combinations": [
                {"X-API-Key": k[0], "X-Client-ID": k[1]}
                for k in MULTI_HEADER_CONFIG["valid_combinations"].keys()
            ],
            "example": {
                "X-API-Key": "demo_key",
                "X-Client-ID": "client_001",
                "X-Timestamp": str(int(time.time())),
            },
        }

    return {}


# =============================================================================
# Lifespan Management
# =============================================================================


@asynccontextmanager
async def app_lifespan(app):
    """
    Manage server lifecycle resources.

    In a production server, this would initialize database connections,
    load configuration, set up caches, etc.

    Args:
        app: The FastMCP application instance
    """
    # Initialize resources
    startup_time = datetime.now(timezone.utc).isoformat()
    print(f"[{SERVER_NAME}] Server starting at {startup_time}")

    # Yield shared state available to all tools
    yield {"startup_time": startup_time, "users": MOCK_USERS, "tasks": MOCK_TASKS}

    # Cleanup on shutdown
    print(f"[{SERVER_NAME}] Server shutting down")


# =============================================================================
# Initialize MCP Server
# =============================================================================

mcp = FastMCP(SERVER_NAME, lifespan=app_lifespan)


# =============================================================================
# User Management Tools
# =============================================================================


@mcp.tool(
    name="mock_list_users",
    annotations={
        "title": "List Users",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def list_users(params: ListUsersInput, ctx: Context) -> str:
    """
    List all users with optional filtering and pagination.

    Returns a paginated list of users that can be filtered by role
    and status. Supports both markdown and JSON output formats.

    Args:
        params (ListUsersInput): Query parameters including:
            - limit (int): Maximum users to return (default: 20)
            - offset (int): Pagination offset (default: 0)
            - role (UserRole): Filter by role (optional)
            - status (str): Filter by status (optional)
            - response_format (ResponseFormat): Output format

    Returns:
        str: Formatted list of users with pagination info
    """
    await ctx.report_progress(0.2, "Fetching users...")

    # Filter users
    users = list(MOCK_USERS.values())

    if params.role:
        users = [u for u in users if u["role"] == params.role.value]

    if params.status:
        users = [u for u in users if u["status"] == params.status]

    await ctx.report_progress(0.6, "Applying pagination...")

    # Paginate
    result = paginate_results(users, params.offset, params.limit)

    await ctx.report_progress(0.9, "Formatting response...")

    if params.response_format == ResponseFormat.JSON:
        return json.dumps(result, indent=2)

    # Markdown format
    if not result["items"]:
        return "No users found matching the criteria."

    output = ["## Users", ""]
    for user in result["items"]:
        output.append(format_user_markdown(user))
        output.append("")

    output.append(f"---\n*Showing {result['count']} of {result['total']} users*")
    if result["has_more"]:
        output.append(f"*Use offset={result['next_offset']} to see more*")

    return "\n".join(output)


@mcp.tool(
    name="mock_get_user",
    annotations={
        "title": "Get User Details",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def get_user(params: GetUserInput) -> str:
    """
    Get detailed information about a specific user.

    Args:
        params (GetUserInput): Parameters including:
            - user_id (str): The unique user identifier
            - response_format (ResponseFormat): Output format

    Returns:
        str: User details in the requested format, or error if not found
    """
    user = MOCK_USERS.get(params.user_id)

    if not user:
        return handle_error(
            "not_found",
            f"User '{params.user_id}' not found",
            "Use 'mock_list_users' to see available user IDs",
        )

    if params.response_format == ResponseFormat.JSON:
        return json.dumps(user, indent=2)

    return f"## User Details\n\n{format_user_markdown(user)}"


@mcp.tool(
    name="mock_create_user",
    annotations={
        "title": "Create User",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": False,
    },
)
async def create_user(params: CreateUserInput) -> str:
    """
    Create a new user in the system.

    Args:
        params (CreateUserInput): User data including:
            - name (str): Full name of the user
            - email (str): Email address (must be unique)
            - role (UserRole): Role to assign (default: viewer)

    Returns:
        str: JSON response with created user details or error
    """
    # Check for duplicate email
    for user in MOCK_USERS.values():
        if user["email"] == params.email:
            return handle_error(
                "duplicate_email",
                f"A user with email '{params.email}' already exists",
                "Use a different email address",
            )

    # Create new user
    new_id = generate_id("user")
    new_user = {
        "id": new_id,
        "name": params.name,
        "email": params.email,
        "role": params.role.value,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    MOCK_USERS[new_id] = new_user

    return json.dumps(
        {"success": True, "message": "User created successfully", "user": new_user},
        indent=2,
    )


# =============================================================================
# Task Management Tools
# =============================================================================


@mcp.tool(
    name="mock_list_tasks",
    annotations={
        "title": "List Tasks",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def list_tasks(params: ListTasksInput, ctx: Context) -> str:
    """
    List all tasks with optional filtering and pagination.

    Returns a paginated list of tasks that can be filtered by status,
    priority, assignee, and tags.

    Args:
        params (ListTasksInput): Query parameters including:
            - limit (int): Maximum tasks to return
            - offset (int): Pagination offset
            - status (TaskStatus): Filter by status
            - priority (TaskPriority): Filter by priority
            - assignee_id (str): Filter by assignee
            - tag (str): Filter by tag
            - response_format (ResponseFormat): Output format

    Returns:
        str: Formatted list of tasks with pagination info
    """
    await ctx.report_progress(0.2, "Fetching tasks...")

    # Filter tasks
    tasks = list(MOCK_TASKS.values())

    if params.status:
        tasks = [t for t in tasks if t["status"] == params.status.value]

    if params.priority:
        tasks = [t for t in tasks if t["priority"] == params.priority.value]

    if params.assignee_id:
        tasks = [t for t in tasks if t["assignee_id"] == params.assignee_id]

    if params.tag:
        tasks = [t for t in tasks if params.tag in t.get("tags", [])]

    await ctx.report_progress(0.6, "Applying pagination...")

    # Paginate
    result = paginate_results(tasks, params.offset, params.limit)

    await ctx.report_progress(0.9, "Formatting response...")

    if params.response_format == ResponseFormat.JSON:
        return json.dumps(result, indent=2)

    # Markdown format
    if not result["items"]:
        return "No tasks found matching the criteria."

    output = ["## Tasks", ""]
    for task in result["items"]:
        output.append(format_task_markdown(task))
        output.append("")

    output.append(f"---\n*Showing {result['count']} of {result['total']} tasks*")
    if result["has_more"]:
        output.append(f"*Use offset={result['next_offset']} to see more*")

    return "\n".join(output)


@mcp.tool(
    name="mock_get_task",
    annotations={
        "title": "Get Task Details",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def get_task(params: GetTaskInput) -> str:
    """
    Get detailed information about a specific task.

    Args:
        params (GetTaskInput): Parameters including:
            - task_id (str): The unique task identifier
            - response_format (ResponseFormat): Output format

    Returns:
        str: Task details in the requested format, or error if not found
    """
    task = MOCK_TASKS.get(params.task_id)

    if not task:
        return handle_error(
            "not_found",
            f"Task '{params.task_id}' not found",
            "Use 'mock_list_tasks' to see available task IDs",
        )

    if params.response_format == ResponseFormat.JSON:
        return json.dumps(task, indent=2)

    return f"## Task Details\n\n{format_task_markdown(task)}"


@mcp.tool(
    name="mock_create_task",
    annotations={
        "title": "Create Task",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": False,
    },
)
async def create_task(params: CreateTaskInput) -> str:
    """
    Create a new task in the system.

    Args:
        params (CreateTaskInput): Task data including:
            - title (str): Title of the task
            - description (str): Detailed description
            - priority (TaskPriority): Priority level
            - assignee_id (str): User to assign
            - tags (List[str]): Tags for categorization
            - due_date (str): Due date in ISO format

    Returns:
        str: JSON response with created task details or error
    """
    # Validate assignee exists
    if params.assignee_id and params.assignee_id not in MOCK_USERS:
        return handle_error(
            "invalid_assignee",
            f"User '{params.assignee_id}' not found",
            "Use 'mock_list_users' to see available user IDs",
        )

    # Create new task
    new_id = generate_id("task")
    new_task = {
        "id": new_id,
        "title": params.title,
        "description": params.description,
        "status": TaskStatus.TODO.value,
        "priority": params.priority.value,
        "assignee_id": params.assignee_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "due_date": params.due_date,
        "tags": params.tags,
    }

    MOCK_TASKS[new_id] = new_task

    return json.dumps(
        {"success": True, "message": "Task created successfully", "task": new_task},
        indent=2,
    )


@mcp.tool(
    name="mock_update_task",
    annotations={
        "title": "Update Task",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def update_task(params: UpdateTaskInput) -> str:
    """
    Update an existing task.

    Only provided fields will be updated; others remain unchanged.

    Args:
        params (UpdateTaskInput): Update data including:
            - task_id (str): Task to update
            - title (str): New title (optional)
            - description (str): New description (optional)
            - status (TaskStatus): New status (optional)
            - priority (TaskPriority): New priority (optional)
            - assignee_id (str): New assignee (optional)

    Returns:
        str: JSON response with updated task or error
    """
    task = MOCK_TASKS.get(params.task_id)

    if not task:
        return handle_error(
            "not_found",
            f"Task '{params.task_id}' not found",
            "Use 'mock_list_tasks' to see available task IDs",
        )

    # Validate assignee if provided
    if params.assignee_id and params.assignee_id not in MOCK_USERS:
        return handle_error(
            "invalid_assignee",
            f"User '{params.assignee_id}' not found",
            "Use 'mock_list_users' to see available user IDs",
        )

    # Update fields
    if params.title is not None:
        task["title"] = params.title
    if params.description is not None:
        task["description"] = params.description
    if params.status is not None:
        task["status"] = params.status.value
    if params.priority is not None:
        task["priority"] = params.priority.value
    if params.assignee_id is not None:
        task["assignee_id"] = params.assignee_id

    task["updated_at"] = datetime.now(timezone.utc).isoformat()

    return json.dumps(
        {"success": True, "message": "Task updated successfully", "task": task},
        indent=2,
    )


@mcp.tool(
    name="mock_delete_task",
    annotations={
        "title": "Delete Task",
        "readOnlyHint": False,
        "destructiveHint": True,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def delete_task(task_id: str) -> str:
    """
    Delete a task from the system.

    This is a destructive operation that cannot be undone.

    Args:
        task_id (str): The unique identifier of the task to delete

    Returns:
        str: JSON response confirming deletion or error
    """
    if task_id not in MOCK_TASKS:
        return handle_error(
            "not_found",
            f"Task '{task_id}' not found",
            "Use 'mock_list_tasks' to see available task IDs",
        )

    deleted_task = MOCK_TASKS.pop(task_id)

    return json.dumps(
        {
            "success": True,
            "message": f"Task '{task_id}' deleted successfully",
            "deleted_task": deleted_task,
        },
        indent=2,
    )


# =============================================================================
# Search and Utility Tools
# =============================================================================


@mcp.tool(
    name="mock_search",
    annotations={
        "title": "Search Resources",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def search(params: SearchInput, ctx: Context) -> str:
    """
    Search across users and tasks.

    Performs a case-insensitive search across user names, emails,
    task titles, and descriptions.

    Args:
        params (SearchInput): Search parameters including:
            - query (str): Search string
            - resource_type (str): Limit to 'users' or 'tasks'
            - limit (int): Maximum results
            - response_format (ResponseFormat): Output format

    Returns:
        str: Search results in the requested format
    """
    await ctx.report_progress(0.1, f"Searching for '{params.query}'...")

    query_lower = params.query.lower()
    results = {"users": [], "tasks": []}

    # Search users
    if params.resource_type in (None, "users"):
        await ctx.report_progress(0.3, "Searching users...")
        for user in MOCK_USERS.values():
            if (
                query_lower in user["name"].lower()
                or query_lower in user["email"].lower()
            ):
                results["users"].append(user)

    # Search tasks
    if params.resource_type in (None, "tasks"):
        await ctx.report_progress(0.6, "Searching tasks...")
        for task in MOCK_TASKS.values():
            if (
                query_lower in task["title"].lower()
                or query_lower in (task.get("description") or "").lower()
                or query_lower in " ".join(task.get("tags", [])).lower()
            ):
                results["tasks"].append(task)

    await ctx.report_progress(0.9, "Formatting results...")

    # Apply limit
    total_count = len(results["users"]) + len(results["tasks"])
    results["users"] = results["users"][: params.limit]
    results["tasks"] = results["tasks"][: max(0, params.limit - len(results["users"]))]

    if params.response_format == ResponseFormat.JSON:
        return json.dumps(
            {"query": params.query, "total_matches": total_count, "results": results},
            indent=2,
        )

    # Markdown format
    output = [f"## Search Results for '{params.query}'", ""]

    if results["users"]:
        output.append("### Users")
        for user in results["users"]:
            output.append(f"- **{user['name']}** ({user['id']}) - {user['email']}")
        output.append("")

    if results["tasks"]:
        output.append("### Tasks")
        for task in results["tasks"]:
            output.append(f"- **{task['title']}** ({task['id']}) - {task['status']}")
        output.append("")

    if not results["users"] and not results["tasks"]:
        output.append("*No results found*")
    else:
        output.append(f"---\n*Found {total_count} total matches*")

    return "\n".join(output)


@mcp.tool(
    name="mock_get_stats",
    annotations={
        "title": "Get Statistics",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def get_stats(response_format: ResponseFormat = ResponseFormat.MARKDOWN) -> str:
    """
    Get overall statistics about the system.

    Returns counts and breakdowns of users and tasks.

    Args:
        response_format (ResponseFormat): Output format ('markdown' or 'json')

    Returns:
        str: System statistics in the requested format
    """
    # Calculate stats
    user_stats = {
        "total": len(MOCK_USERS),
        "by_role": {},
        "by_status": {"active": 0, "inactive": 0},
    }

    for user in MOCK_USERS.values():
        role = user["role"]
        user_stats["by_role"][role] = user_stats["by_role"].get(role, 0) + 1
        user_stats["by_status"][user["status"]] += 1

    task_stats = {"total": len(MOCK_TASKS), "by_status": {}, "by_priority": {}}

    for task in MOCK_TASKS.values():
        status = task["status"]
        priority = task["priority"]
        task_stats["by_status"][status] = task_stats["by_status"].get(status, 0) + 1
        task_stats["by_priority"][priority] = (
            task_stats["by_priority"].get(priority, 0) + 1
        )

    stats = {
        "users": user_stats,
        "tasks": task_stats,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    if response_format == ResponseFormat.JSON:
        return json.dumps(stats, indent=2)

    # Markdown format
    output = [
        "## System Statistics",
        "",
        "### Users",
        f"- **Total**: {user_stats['total']}",
        f"- **Active**: {user_stats['by_status']['active']}",
        f"- **Inactive**: {user_stats['by_status']['inactive']}",
        "",
        "**By Role:**",
    ]

    for role, count in user_stats["by_role"].items():
        output.append(f"- {role}: {count}")

    output.extend(
        ["", "### Tasks", f"- **Total**: {task_stats['total']}", "", "**By Status:**"]
    )

    for status, count in task_stats["by_status"].items():
        output.append(f"- {status}: {count}")

    output.append("")
    output.append("**By Priority:**")

    for priority, count in task_stats["by_priority"].items():
        output.append(f"- {priority}: {count}")

    return "\n".join(output)


# =============================================================================
# Authentication Tools - Different Auth Methods
# =============================================================================


@mcp.tool(
    name="auth_get_info",
    annotations={
        "title": "Get Authentication Info",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def auth_get_info(
    auth_method: Optional[AuthMethod] = None, include_demo_credentials: bool = True
) -> str:
    """
    Get information about available authentication methods.

    Returns documentation and demo credentials for each auth method.
    Use this to understand how to authenticate with other tools.

    Args:
        auth_method (AuthMethod): Specific method to get info for (optional, returns all if not specified)
        include_demo_credentials (bool): Include demo credentials in the response

    Returns:
        str: JSON with auth method documentation and credentials
    """
    methods_info = {}

    if auth_method is None or auth_method == AuthMethod.NONE:
        methods_info["none"] = {
            "description": "No authentication required - public endpoints",
            "usage": "Simply call the tool without any auth parameters",
            "tool": "auth_public_data",
        }

    if auth_method is None or auth_method == AuthMethod.BEARER:
        info = {
            "description": "Bearer token authentication via Authorization header",
            "header_format": "Authorization: Bearer <token>",
            "tool": "auth_bearer_protected",
        }
        if include_demo_credentials:
            info["demo_tokens"] = list(VALID_BEARER_TOKENS.keys())
            info["example"] = "bearer_token: demo_token"
        methods_info["bearer"] = info

    if auth_method is None or auth_method == AuthMethod.HEADER:
        info = {
            "description": "Custom header (API key) authentication",
            "header_format": "X-API-Key: <api_key>",
            "tool": "auth_header_protected",
        }
        if include_demo_credentials:
            info["demo_keys"] = list(VALID_API_KEYS.keys())
            info["example"] = "api_key: demo_key"
        methods_info["header"] = info

    if auth_method is None or auth_method == AuthMethod.OAUTH2:
        info = {
            "description": "OAuth2 authentication with scope-based access control",
            "authorization_url": OAUTH2_CONFIG["authorization_url"],
            "token_url": OAUTH2_CONFIG["token_url"],
            "client_id": OAUTH2_CONFIG["client_id"],
            "client_secret": OAUTH2_CONFIG["client_secret"],
            "scope": OAUTH2_CONFIG["scope"],
            "server_url": OAUTH2_CONFIG["server_url"],
            "allowed_domains": OAUTH2_CONFIG["allowed_domains"],
            "tool": "auth_oauth2_protected",
        }
        if include_demo_credentials:
            info["demo_tokens"] = list(VALID_OAUTH2_TOKENS.keys())
            info["example"] = "access_token: oauth2_demo_token"
        methods_info["oauth2"] = info

    if auth_method is None or auth_method == AuthMethod.MULTI_HEADER:
        info = {
            "description": "Multi-header authentication requiring multiple credentials",
            "required_headers": MULTI_HEADER_CONFIG["required_headers"],
            "tool": "auth_multi_header_protected",
        }
        if include_demo_credentials:
            info["demo_combinations"] = [
                {"api_key": k[0], "client_id": k[1]}
                for k in MULTI_HEADER_CONFIG["valid_combinations"].keys()
            ]
            info["example"] = {
                "api_key": "demo_key",
                "client_id": "client_001",
                "timestamp": "(auto-generated if not provided)",
            }
        methods_info["multi_header"] = info

    return json.dumps(
        {
            "auth_methods": methods_info,
            "summary": {
                "total_methods": len(methods_info),
                "supported": list(methods_info.keys()),
            },
        },
        indent=2,
    )


# -----------------------------------------------------------------------------
# AUTH METHOD: None (Public Endpoints)
# -----------------------------------------------------------------------------


@mcp.tool(
    name="auth_public_data",
    annotations={
        "title": "Public Data (No Auth)",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def auth_public_data(
    include_metadata: bool = False,
    response_format: ResponseFormat = ResponseFormat.JSON,
) -> str:
    """
    Access public data without authentication.

    This endpoint demonstrates a public API that requires no authentication.
    It returns general system information available to anyone.

    AUTH METHOD: None

    Args:
        include_metadata (bool): Include extra metadata in response
        response_format (ResponseFormat): Output format ('markdown' or 'json')

    Returns:
        str: Public system information
    """
    # Validate (always passes for public endpoints)
    is_valid, error_msg, auth_context = validate_no_auth()

    public_data = {
        "server_name": SERVER_NAME,
        "version": "1.0.0",
        "auth_method": "none",
        "auth_context": auth_context,
        "public_stats": {
            "total_users": len(MOCK_USERS),
            "total_tasks": len(MOCK_TASKS),
            "server_status": "operational",
        },
        "available_auth_methods": [m.value for m in AuthMethod],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if include_metadata:
        public_data["metadata"] = {
            "api_version": "v1",
            "supported_formats": ["json", "markdown"],
            "rate_limit": "1000 requests/hour (public)",
            "documentation_url": "https://docs.example.com/api",
        }

    if response_format == ResponseFormat.MARKDOWN:
        output = [
            "## Public API Information",
            "",
            f"**Server**: {public_data['server_name']} v{public_data['version']}",
            f"**Status**: {public_data['public_stats']['server_status']}",
            "**Auth Method**: None (public endpoint)",
            "",
            "### Statistics",
            f"- Total Users: {public_data['public_stats']['total_users']}",
            f"- Total Tasks: {public_data['public_stats']['total_tasks']}",
            "",
            "### Available Auth Methods",
        ]
        for method in public_data["available_auth_methods"]:
            output.append(f"- {method}")
        return "\n".join(output)

    return json.dumps(public_data, indent=2)


# -----------------------------------------------------------------------------
# AUTH METHOD: Bearer Token
# -----------------------------------------------------------------------------


@mcp.tool(
    name="auth_bearer_protected",
    annotations={
        "title": "Bearer Token Protected",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def auth_bearer_protected(
    bearer_token: str,
    resource_id: Optional[str] = None,
    response_format: ResponseFormat = ResponseFormat.JSON,
) -> str:
    """
    Access protected data using Bearer token authentication.

    This endpoint demonstrates Bearer token authentication commonly used
    with OAuth2 access tokens or API tokens.

    AUTH METHOD: Bearer Token
    Header format: Authorization: Bearer <token>

    Demo tokens:
    - demo_token (scope: read:write)
    - mock_bearer_token_12345 (scope: read:write)
    - mock_bearer_token_67890 (scope: read)

    Args:
        bearer_token (str): The bearer token for authentication
        resource_id (str): Optional resource ID to fetch specific data
        response_format (ResponseFormat): Output format ('markdown' or 'json')

    Returns:
        str: Protected data or authentication error
    """
    # Validate bearer token
    is_valid, error_msg, auth_context = validate_bearer_token(bearer_token)

    if not is_valid:
        return format_auth_error(AuthMethod.BEARER, error_msg)

    # Build response with protected data
    response_data = {
        "success": True,
        "auth_method": "bearer",
        "auth_context": auth_context,
        "message": "Successfully authenticated with Bearer token",
        "protected_data": {
            "user_profile": MOCK_USERS.get(auth_context["user_id"], {}),
            "access_scope": auth_context["scope"],
            "permissions": auth_context["scope"].split(":"),
        },
    }

    # If specific resource requested
    if resource_id:
        if resource_id in MOCK_USERS:
            response_data["requested_resource"] = {
                "type": "user",
                "data": MOCK_USERS[resource_id],
            }
        elif resource_id in MOCK_TASKS:
            response_data["requested_resource"] = {
                "type": "task",
                "data": MOCK_TASKS[resource_id],
            }
        else:
            response_data["requested_resource"] = {
                "error": f"Resource '{resource_id}' not found"
            }

    if response_format == ResponseFormat.MARKDOWN:
        output = [
            "## Bearer Token Authentication Success",
            "",
            f"**Authenticated User**: {auth_context['user_id']}",
            f"**Scope**: {auth_context['scope']}",
            f"**Token**: {auth_context['token']}",
            "",
            "### User Profile",
        ]
        profile = response_data["protected_data"]["user_profile"]
        if profile:
            output.append(f"- Name: {profile.get('name', 'N/A')}")
            output.append(f"- Email: {profile.get('email', 'N/A')}")
            output.append(f"- Role: {profile.get('role', 'N/A')}")
        return "\n".join(output)

    return json.dumps(response_data, indent=2)


# -----------------------------------------------------------------------------
# AUTH METHOD: Custom Header (API Key)
# -----------------------------------------------------------------------------


@mcp.tool(
    name="auth_header_protected",
    annotations={
        "title": "Header Auth Protected",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def auth_header_protected(
    api_key: str,
    action: str = "list",
    data: Optional[Dict[str, Any]] = None,
    response_format: ResponseFormat = ResponseFormat.JSON,
) -> str:
    """
    Access protected data using custom header (API key) authentication.

    This endpoint demonstrates API key authentication via custom headers,
    commonly used for service-to-service communication.

    AUTH METHOD: Custom Header
    Header format: X-API-Key: <api_key>

    Demo API keys:
    - demo_key (tier: premium)
    - mock_api_key_abcdef (tier: premium)
    - mock_api_key_ghijkl (tier: basic)

    Args:
        api_key (str): The API key for authentication
        action (str): Action to perform ('list', 'get', 'create')
        data (dict): Additional data for create action
        response_format (ResponseFormat): Output format

    Returns:
        str: Protected data or authentication error
    """
    # Validate API key
    is_valid, error_msg, auth_context = validate_header_auth(api_key)

    if not is_valid:
        return format_auth_error(AuthMethod.HEADER, error_msg)

    # Process action based on tier
    tier = auth_context["tier"]
    allowed_actions = {"premium": ["list", "get", "create"], "basic": ["list", "get"]}

    if action not in allowed_actions.get(tier, []):
        return json.dumps(
            {
                "error": True,
                "type": "permission_denied",
                "message": f"Action '{action}' not allowed for tier '{tier}'",
                "allowed_actions": allowed_actions.get(tier, []),
                "upgrade_hint": "Upgrade to premium tier for full access",
            },
            indent=2,
        )

    # Execute action
    result_data = {
        "success": True,
        "auth_method": "header",
        "auth_context": auth_context,
        "action": action,
        "tier": tier,
    }

    if action == "list":
        result_data["data"] = {
            "users_count": len(MOCK_USERS),
            "tasks_count": len(MOCK_TASKS),
            "user_ids": list(MOCK_USERS.keys()),
            "task_ids": list(MOCK_TASKS.keys()),
        }
    elif action == "get":
        result_data["data"] = {
            "users": list(MOCK_USERS.values())[:3],  # Limited preview
            "tasks": list(MOCK_TASKS.values())[:3],
        }
    elif action == "create":
        if data:
            result_data["data"] = {
                "message": "Create action simulated (demo mode)",
                "would_create": data,
            }
        else:
            result_data["data"] = {"message": "No data provided for create action"}

    if response_format == ResponseFormat.MARKDOWN:
        output = [
            "## API Key Authentication Success",
            "",
            f"**Authenticated User**: {auth_context['user_id']}",
            f"**API Key**: {auth_context['api_key']}",
            f"**Tier**: {tier}",
            f"**Action**: {action}",
            "",
            "### Result",
            "```json",
            json.dumps(result_data["data"], indent=2),
            "```",
        ]
        return "\n".join(output)

    return json.dumps(result_data, indent=2)


# -----------------------------------------------------------------------------
# AUTH METHOD: OAuth2
# -----------------------------------------------------------------------------


@mcp.tool(
    name="auth_oauth2_protected",
    annotations={
        "title": "OAuth2 Protected",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def auth_oauth2_protected(
    access_token: str,
    required_scopes: Optional[List[str]] = None,
    resource_type: str = "users",
    operation: str = "read",
    response_format: ResponseFormat = ResponseFormat.JSON,
) -> str:
    """
    Access protected data using OAuth2 authentication.

    This endpoint demonstrates OAuth2 authentication with scope-based
    access control. Different operations require different scopes.

    AUTH METHOD: MCP OAuth2
    Token format: Authorization: Bearer <access_token>

    Demo tokens:
    - oauth2_demo_token (scopes: read, write, admin)
    - oauth2_access_token_xyz (scopes: read, write)

    Available scopes:
    - read: Read access to resources
    - write: Write access to resources
    - admin: Administrative operations

    Args:
        access_token (str): OAuth2 access token
        required_scopes (list): Scopes needed for operation
        resource_type (str): Resource to access ('users', 'tasks', 'settings')
        operation (str): Operation to perform ('read', 'write', 'delete')
        response_format (ResponseFormat): Output format

    Returns:
        str: Protected data or authentication error
    """
    # Determine required scopes based on operation
    operation_scopes = {
        "read": ["read"],
        "write": ["read", "write"],
        "delete": ["read", "write", "admin"],
    }

    required = required_scopes or operation_scopes.get(operation, ["read"])

    # Validate OAuth2 token
    is_valid, error_msg, auth_context = validate_oauth2_token(
        access_token, required_scopes=required
    )

    if not is_valid:
        return format_auth_error(AuthMethod.OAUTH2, error_msg)

    # Build response
    response_data = {
        "success": True,
        "auth_method": "oauth2",
        "auth_context": auth_context,
        "request": {
            "resource_type": resource_type,
            "operation": operation,
            "required_scopes": required,
        },
    }

    # Execute operation based on resource type
    if resource_type == "users":
        if operation == "read":
            response_data["data"] = {
                "users": list(MOCK_USERS.values()),
                "count": len(MOCK_USERS),
            }
        elif operation == "write":
            response_data["data"] = {
                "message": "Write operation simulated (demo mode)",
                "writable_fields": ["name", "email", "role", "status"],
            }
        elif operation == "delete":
            response_data["data"] = {
                "message": "Delete operation simulated (demo mode)",
                "warning": "This would permanently delete user data",
            }

    elif resource_type == "tasks":
        if operation == "read":
            response_data["data"] = {
                "tasks": list(MOCK_TASKS.values()),
                "count": len(MOCK_TASKS),
            }
        elif operation == "write":
            response_data["data"] = {
                "message": "Write operation simulated (demo mode)",
                "writable_fields": ["title", "description", "status", "priority"],
            }
        elif operation == "delete":
            response_data["data"] = {
                "message": "Delete operation simulated (demo mode)",
                "warning": "This would permanently delete task data",
            }

    elif resource_type == "settings":
        if "admin" not in auth_context.get("scopes", []):
            return json.dumps(
                {
                    "error": True,
                    "type": "insufficient_scope",
                    "message": "Settings access requires 'admin' scope",
                    "current_scopes": auth_context.get("scopes", []),
                    "required_scopes": ["admin"],
                },
                indent=2,
            )

        response_data["data"] = {
            "settings": {
                "api_version": "v1",
                "rate_limits": {"default": 1000, "premium": 10000},
                "features": ["users", "tasks", "oauth2", "webhooks"],
            }
        }

    if response_format == ResponseFormat.MARKDOWN:
        output = [
            "## OAuth2 Authentication Success",
            "",
            f"**Authenticated User**: {auth_context['user_id']}",
            f"**Scopes**: {', '.join(auth_context['scopes'])}",
            f"**Token Expires**: {auth_context['expires_at']}",
            "",
            f"### {operation.title()} {resource_type.title()}",
            "```json",
            json.dumps(response_data.get("data", {}), indent=2),
            "```",
        ]
        return "\n".join(output)

    return json.dumps(response_data, indent=2)


# -----------------------------------------------------------------------------
# AUTH METHOD: Multiple Headers
# -----------------------------------------------------------------------------


@mcp.tool(
    name="auth_multi_header_protected",
    annotations={
        "title": "Multi-Header Auth Protected",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def auth_multi_header_protected(
    api_key: str,
    client_id: str,
    timestamp: Optional[str] = None,
    signature: Optional[str] = None,
    action: str = "verify",
    payload: Optional[Dict[str, Any]] = None,
    response_format: ResponseFormat = ResponseFormat.JSON,
) -> str:
    """
    Access protected data using multi-header authentication.

    This endpoint demonstrates authentication requiring multiple headers,
    commonly used for high-security APIs with request signing.

    AUTH METHOD: Multiple Headers
    Required headers:
    - X-API-Key: <api_key>
    - X-Client-ID: <client_id>
    - X-Timestamp: <unix_timestamp>
    - X-Signature: <optional_hmac_signature>

    Demo combinations:
    - api_key: demo_key, client_id: client_001 (full permissions)
    - api_key: demo_key, client_id: client_002 (read only)

    Args:
        api_key (str): API key header value
        client_id (str): Client ID header value
        timestamp (str): Unix timestamp (auto-generated if not provided)
        signature (str): Optional HMAC signature
        action (str): Action to perform ('verify', 'fetch', 'submit')
        payload (dict): Data for submit action
        response_format (ResponseFormat): Output format

    Returns:
        str: Protected data or authentication error
    """
    # Use current timestamp if not provided
    ts = timestamp or str(int(time.time()))

    # Validate multi-header auth
    is_valid, error_msg, auth_context = validate_multi_header_auth(
        api_key=api_key,
        client_id=client_id,
        timestamp=ts,
        signature=signature,
    )

    if not is_valid:
        return format_auth_error(AuthMethod.MULTI_HEADER, error_msg)

    # Check permissions for action
    permissions = auth_context.get("permissions", [])
    action_permissions = {
        "verify": [],  # Anyone can verify
        "fetch": ["read", "all"],
        "submit": ["write", "all"],
    }

    required_perms = action_permissions.get(action, [])
    if required_perms and not any(p in permissions for p in required_perms):
        return json.dumps(
            {
                "error": True,
                "type": "permission_denied",
                "message": f"Action '{action}' requires permissions: {required_perms}",
                "current_permissions": permissions,
            },
            indent=2,
        )

    # Build response
    response_data = {
        "success": True,
        "auth_method": "multi_header",
        "auth_context": auth_context,
        "action": action,
        "headers_validated": {
            "X-API-Key": api_key[:8] + "...",
            "X-Client-ID": client_id,
            "X-Timestamp": ts,
            "X-Signature": "provided" if signature else "not provided",
        },
    }

    if action == "verify":
        response_data["data"] = {
            "message": "Multi-header authentication successful",
            "validated_at": datetime.now(timezone.utc).isoformat(),
            "permissions": permissions,
        }

    elif action == "fetch":
        response_data["data"] = {
            "message": "Data fetch successful",
            "summary": {"users": len(MOCK_USERS), "tasks": len(MOCK_TASKS)},
            "sample_data": {
                "first_user": list(MOCK_USERS.values())[0] if MOCK_USERS else None,
                "first_task": list(MOCK_TASKS.values())[0] if MOCK_TASKS else None,
            },
        }

    elif action == "submit":
        response_data["data"] = {
            "message": "Submit action simulated (demo mode)",
            "payload_received": payload or {},
            "would_process": True,
            "estimated_processing_time": "< 1 second",
        }

    if response_format == ResponseFormat.MARKDOWN:
        output = [
            "## Multi-Header Authentication Success",
            "",
            "### Validated Headers",
            f"- **X-API-Key**: {api_key[:8]}...",
            f"- **X-Client-ID**: {client_id}",
            f"- **X-Timestamp**: {ts}",
            f"- **X-Signature**: {'✓ provided' if signature else '○ not provided'}",
            "",
            f"**User**: {auth_context['user_id']}",
            f"**Permissions**: {', '.join(permissions)}",
            f"**Action**: {action}",
            "",
            "### Result",
            "```json",
            json.dumps(response_data.get("data", {}), indent=2),
            "```",
        ]
        return "\n".join(output)

    return json.dumps(response_data, indent=2)


# =============================================================================
# Resources (Alternative to Tools for Simple Data Access)
# =============================================================================


@mcp.resource("mock://users/{user_id}")
async def user_resource(user_id: str) -> str:
    """
    Expose user data as an MCP resource.

    Resources provide a simpler interface for data access using URI templates.
    """
    user = MOCK_USERS.get(user_id)
    if not user:
        return json.dumps({"error": f"User {user_id} not found"})
    return json.dumps(user, indent=2)


@mcp.resource("mock://tasks/{task_id}")
async def task_resource(task_id: str) -> str:
    """
    Expose task data as an MCP resource.
    """
    task = MOCK_TASKS.get(task_id)
    if not task:
        return json.dumps({"error": f"Task {task_id} not found"})
    return json.dumps(task, indent=2)


@mcp.resource("mock://stats")
async def stats_resource() -> str:
    """
    Expose system statistics as an MCP resource.
    """
    return await get_stats(ResponseFormat.JSON)


# =============================================================================
# Main Entry Point
# =============================================================================

# In-memory store for OAuth authorization codes
OAUTH_AUTH_CODES: Dict[str, Dict[str, Any]] = {}


def main():
    """Parse arguments and run the MCP server."""
    parser = argparse.ArgumentParser(
        description="Mock MCP Server - A demonstration MCP server"
    )
    parser.add_argument(
        "--http", action="store_true", help="Run with HTTP transport instead of stdio"
    )
    parser.add_argument(
        "--port", type=int, default=8000, help="Port for HTTP transport (default: 8000)"
    )

    args = parser.parse_args()

    if args.http:
        import secrets
        import urllib.parse

        import uvicorn
        from starlette.applications import Starlette
        from starlette.middleware import Middleware
        from starlette.middleware.cors import CORSMiddleware
        from starlette.requests import Request
        from starlette.responses import JSONResponse, RedirectResponse
        from starlette.routing import Mount, Route

        # Configure transport security to allow requests from Docker containers
        # and local development
        security_settings = TransportSecuritySettings(
            enable_dns_rebinding_protection=False  # Disable for easier development
        )

        # Update the mcp settings to use our security configuration
        mcp.settings.transport_security = security_settings

        # Get the SSE app from FastMCP
        sse_app = mcp.sse_app()

        # OAuth2 Authorization endpoint
        async def oauth_authorize(request: Request):
            """
            Mock OAuth2 authorization endpoint.

            This simulates the authorization server's authorize endpoint.
            In a real OAuth flow, this would show a login/consent page.
            For testing, it auto-approves and redirects with an auth code.
            """
            client_id = request.query_params.get("client_id")
            redirect_uri = request.query_params.get("redirect_uri")
            state = request.query_params.get("state", "")
            scope = request.query_params.get("scope", "read")

            if not client_id or not redirect_uri:
                return JSONResponse(
                    {
                        "error": "invalid_request",
                        "error_description": "client_id and redirect_uri are required",
                    },
                    status_code=400,
                )

            # Generate an authorization code
            auth_code = secrets.token_urlsafe(32)

            # Store the auth code with its metadata (expires in 10 minutes)
            OAUTH_AUTH_CODES[auth_code] = {
                "client_id": client_id,
                "redirect_uri": redirect_uri,
                "scope": scope,
                "expires_at": time.time() + 600,  # 10 minutes
                "user_id": "user_001",  # Auto-authenticate as demo user
            }

            # Build redirect URL with auth code
            parsed = urllib.parse.urlparse(redirect_uri)
            query_params = urllib.parse.parse_qs(parsed.query)
            query_params["code"] = [auth_code]
            if state:
                query_params["state"] = [state]

            new_query = urllib.parse.urlencode(query_params, doseq=True)
            redirect_url = urllib.parse.urlunparse(
                (
                    parsed.scheme,
                    parsed.netloc,
                    parsed.path,
                    parsed.params,
                    new_query,
                    parsed.fragment,
                )
            )

            print(
                f"[OAuth] Authorization granted. Redirecting to: {redirect_url[:100]}..."
            )
            return RedirectResponse(url=redirect_url, status_code=302)

        # OAuth2 Token endpoint
        async def oauth_token(request: Request):
            """
            Mock OAuth2 token endpoint.

            This exchanges an authorization code for access and refresh tokens.
            """
            # Support both form data and JSON body
            content_type = request.headers.get("content-type", "")
            if "application/json" in content_type:
                try:
                    body = await request.json()
                except:
                    body = {}
            else:
                form = await request.form()
                body = dict(form)

            grant_type = body.get("grant_type")
            code = body.get("code")
            client_id = body.get("client_id")
            client_secret = body.get("client_secret")
            redirect_uri = body.get("redirect_uri")

            # Handle refresh token grant
            if grant_type == "refresh_token":
                refresh_token = body.get("refresh_token")
                if refresh_token and refresh_token.startswith("mock_refresh_"):
                    # Issue new tokens
                    access_token = f"oauth2_demo_token_{secrets.token_hex(8)}"
                    new_refresh_token = f"mock_refresh_{secrets.token_hex(16)}"

                    # Add to valid tokens
                    VALID_OAUTH2_TOKENS[access_token] = {
                        "user_id": "user_001",
                        "scopes": ["read", "write", "admin"],
                        "expires_at": time.time() + 3600,
                    }

                    return JSONResponse(
                        {
                            "access_token": access_token,
                            "token_type": "Bearer",
                            "expires_in": 3600,
                            "refresh_token": new_refresh_token,
                            "scope": "read write admin",
                        }
                    )
                else:
                    return JSONResponse(
                        {
                            "error": "invalid_grant",
                            "error_description": "Invalid refresh token",
                        },
                        status_code=400,
                    )

            # Handle authorization code grant
            if grant_type != "authorization_code":
                return JSONResponse(
                    {
                        "error": "unsupported_grant_type",
                        "error_description": f"Grant type '{grant_type}' not supported",
                    },
                    status_code=400,
                )

            if not code:
                return JSONResponse(
                    {
                        "error": "invalid_request",
                        "error_description": "code is required",
                    },
                    status_code=400,
                )

            # Validate the authorization code
            auth_data = OAUTH_AUTH_CODES.get(code)
            if not auth_data:
                return JSONResponse(
                    {
                        "error": "invalid_grant",
                        "error_description": "Invalid or expired authorization code",
                    },
                    status_code=400,
                )

            # Check if code has expired
            if time.time() > auth_data["expires_at"]:
                del OAUTH_AUTH_CODES[code]
                return JSONResponse(
                    {
                        "error": "invalid_grant",
                        "error_description": "Authorization code has expired",
                    },
                    status_code=400,
                )

            # Remove used code (single use)
            del OAUTH_AUTH_CODES[code]

            # Generate tokens
            access_token = f"oauth2_demo_token_{secrets.token_hex(8)}"
            refresh_token = f"mock_refresh_{secrets.token_hex(16)}"

            # Add the new access token to valid tokens
            VALID_OAUTH2_TOKENS[access_token] = {
                "user_id": auth_data["user_id"],
                "scopes": auth_data["scope"].split(),
                "expires_at": time.time() + 3600,
            }

            print(f"[OAuth] Token issued: {access_token[:20]}...")

            return JSONResponse(
                {
                    "access_token": access_token,
                    "token_type": "Bearer",
                    "expires_in": 3600,
                    "refresh_token": refresh_token,
                    "scope": auth_data["scope"],
                }
            )

        # Combine MCP SSE app with OAuth routes
        routes = [
            Route("/mcp/oauth/authorize", oauth_authorize, methods=["GET"]),
            Route("/mcp/oauth/token", oauth_token, methods=["POST"]),
            Mount("/", app=sse_app),  # Mount SSE app at root for /sse and /messages
        ]

        middleware = [
            Middleware(
                CORSMiddleware,
                allow_origins=["*"],
                allow_credentials=True,
                allow_methods=["*"],
                allow_headers=["*"],
            )
        ]

        app = Starlette(routes=routes, middleware=middleware)

        print(
            f"Starting {SERVER_NAME} with SSE transport on http://0.0.0.0:{args.port}"
        )
        print("OAuth endpoints available at:")
        print("  - GET  /mcp/oauth/authorize")
        print("  - POST /mcp/oauth/token")
        uvicorn.run(app, host="0.0.0.0", port=args.port)
    else:
        print(f"Starting {SERVER_NAME} with stdio transport")
        mcp.run()


if __name__ == "__main__":
    main()
