"""
MCP Client Tool Connector implementation.

Provides Model Context Protocol client integration for connecting to MCP servers.
Supports multiple transports:
- Stdio: Launch and communicate with local subprocesses
- SSE: Server-Sent Events for remote server communication
"""

import asyncio
import json
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Dict, List, Optional

# MCP SDK imports
from mcp import ClientSession, StdioServerParameters, types
from mcp.client.sse import sse_client
from mcp.client.stdio import stdio_client

from apps.common.logging_utils import get_logger
from apps.core.connectors.base import BaseConnector

logger = get_logger(__name__)


class MCPClientConnector(BaseConnector):
    """
    MCP Client Tool Connector for agent tools.

    Connects to and interacts with Model Context Protocol servers.
    Supports Stdio (subprocess) and SSE (HTTP) transports.
    """

    def __init__(self, config: Dict[str, Any]):
        """Initialize MCP Client connector"""
        super().__init__(config)
        self._server_params: Optional[StdioServerParameters] = None
        self._endpoint: Optional[str] = None
        self._transport: str = "stdio"
        self._headers: Dict[str, str] = {}
        self._cached_tools: Optional[List[Dict[str, Any]]] = None

    def get_manifest(self) -> Dict[str, Any]:
        """Get connector manifest"""
        import os

        manifest_path = os.path.join(os.path.dirname(__file__), "manifest.json")
        with open(manifest_path, "r") as f:
            return json.load(f)

    def _initialize(self) -> None:
        """Initialize MCP client configuration"""
        try:
            # Basic Configuration
            self._transport = self.config.get("transport", "stdio")
            self._endpoint = self.config.get("endpoint") or self.config.get(
                "server_command"
            )

            # Authentication
            # Credential service might save type as _auth_type
            auth_type = self.config.get("authentication") or self.config.get(
                "_auth_type", "none"
            )

            # Normalize auth type
            if auth_type == "oauth2":
                auth_type = "mcp-oauth2"

            self._headers = {}

            if auth_type == "bearer":
                token = self.config.get("bearer_token")
                if token:
                    self._headers["Authorization"] = f"Bearer {token}"
            elif auth_type == "header":
                header_name = self.config.get("header_name")
                header_value = self.config.get("header_value") or self.config.get(
                    "api_key"
                )

                if header_name and header_value:
                    self._headers[header_name] = header_value
                elif header_value:
                    self._headers["X-API-Key"] = header_value

                # Also support headers_json for extended header auth
                headers_json = self.config.get("headers_json")
                if headers_json:
                    try:
                        custom_headers = json.loads(headers_json)
                        if isinstance(custom_headers, dict):
                            self._headers.update(custom_headers)
                    except json.JSONDecodeError:
                        logger.warning("Invalid JSON in headers_json for header auth")
            elif auth_type == "multiple-headers":
                headers_json = self.config.get("headers_json")
                if headers_json:
                    try:
                        custom_headers = json.loads(headers_json)
                        if isinstance(custom_headers, dict):
                            self._headers.update(custom_headers)
                    except json.JSONDecodeError:
                        logger.warning("Invalid JSON in headers_json")
            elif auth_type == "mcp-oauth2":
                token = self.config.get("access_token")
                if token:
                    self._headers["Authorization"] = f"Bearer {token}"

            # Transport specific setup
            if self._transport == "stdio":
                server_command = self._endpoint
                server_args = self.config.get("server_args", [])

                if not server_command:
                    # Fallback for backward compatibility
                    server_command = self.config.get("server_command")

                if not server_command:
                    raise ValueError(
                        "Endpoint (Command) is required for Stdio transport"
                    )

                # Ensure server_args is a list
                if isinstance(server_args, str):
                    server_args = server_args.split()

                self._server_params = StdioServerParameters(
                    command=server_command,
                    args=server_args,
                    env=self.config.get("server_env"),
                )
                logger.info(f"MCP client configured for Stdio: {server_command}")

            elif self._transport in ["sse", "http-streamable"]:
                if not self._endpoint:
                    raise ValueError(
                        "Endpoint (URL) is required for HTTP/SSE transport"
                    )

                # Normalize endpoint: Ensure trailing slash to avoid 307 redirects
                # which can cause httpx to drop Auth headers
                if not self._endpoint.endswith("/"):
                    self._endpoint += "/"

                logger.info(
                    f"MCP client configured for {self._transport}: {self._endpoint}"
                )

        except Exception as e:
            logger.error(f"Failed to initialize MCP client: {str(e)}")
            raise

    def _execute(self, action_id: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Execute MCP client action"""
        if action_id == "call_tool":
            return self._execute_call_tool(inputs)
        elif action_id == "list_tools":
            return self._execute_list_tools(inputs)
        else:
            raise ValueError(f"Unknown action: {action_id}")

    @asynccontextmanager
    async def _create_session(self) -> AsyncGenerator[ClientSession, None]:
        """Create an MCP session based on transport configuration"""
        if not hasattr(self, "_server_params") and self._transport == "stdio":
            self._initialize()

        # Ensure initialization happened
        if self._transport == "stdio" and not self._server_params:
            self._initialize()

        if self._transport == "stdio":
            async with stdio_client(self._server_params) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    yield session

        elif self._transport in ["sse", "http-streamable"]:
            # Note: sse_client signature might vary based on SDK version
            # Assuming standard context manager usage with headers
            async with sse_client(self._endpoint, headers=self._headers) as (
                read,
                write,
            ):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    yield session
        else:
            raise ValueError(f"Unsupported transport: {self._transport}")

    async def _run_async_operation(self, operation: str, **kwargs) -> Dict[str, Any]:
        """Run an async operation inside an MCP session"""
        async with self._create_session() as session:
            logger.debug(f"MCP session connected via {self._transport}")

            if operation == "list_tools":
                result = await session.list_tools()
                tools_list = []
                for tool in result.tools:
                    tool_info = {
                        "name": tool.name,
                        "description": tool.description or "",
                    }
                    if tool.inputSchema:
                        tool_info["inputSchema"] = tool.inputSchema
                    tools_list.append(tool_info)
                return {"tools": tools_list}

            elif operation == "call_tool":
                tool_name = kwargs.get("tool_name")
                arguments = kwargs.get("arguments", {})

                # Execute tool call
                result = await session.call_tool(tool_name, arguments=arguments)

                # Process content
                content_list = []
                for item in result.content:
                    if isinstance(item, types.TextContent):
                        content_list.append({"type": "text", "text": item.text})
                    elif isinstance(item, types.ImageContent):
                        content_list.append(
                            {
                                "type": "image",
                                "data": item.data,
                                "mimeType": item.mimeType,
                            }
                        )
                    elif isinstance(item, types.EmbeddedResource):
                        content_list.append(
                            {"type": "resource", "resource": str(item.resource)}
                        )
                    else:
                        content_list.append({"type": "unknown", "data": str(item)})

                return {
                    "result": content_list,
                    "isError": getattr(result, "isError", False),
                    "error": None,
                }
            else:
                raise ValueError(f"Unknown operation: {operation}")

    def _execute_list_tools(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """List available tools, applying filtering logic"""
        logger.info("Listing MCP tools")

        try:
            # Re-initialize config for parameters (in case inputs override config)
            # But for list_tools we rely on configured connector settings

            result = asyncio.run(self._run_async_operation("list_tools"))
            all_tools = result.get("tools", [])

            # Check if we should skip filtering (e.g. for configuration UI)
            if inputs.get("ignore_filtering"):
                return {"tools": all_tools}

            # Apply Filtering Logic
            tools_selection = self.config.get("tools_selection", "all")
            selected_list = self.config.get("tools_list", [])

            filtered_tools = []
            if tools_selection == "all":
                filtered_tools = all_tools
            elif tools_selection == "selected":
                filtered_tools = [t for t in all_tools if t["name"] in selected_list]
            elif tools_selection == "all-except":
                filtered_tools = [
                    t for t in all_tools if t["name"] not in selected_list
                ]

            # Format explicitly for UI selector if needed, or return standard format
            return {"tools": filtered_tools}

        except Exception as e:
            # Try to uncover actual error if it's an ExceptionGroup/TaskGroup error
            if hasattr(e, "exceptions"):
                error_msg = f"Failed to list MCP tools: {e.exceptions}"
            else:
                error_msg = f"Failed to list MCP tools: {str(e)}"

            logger.error(error_msg, exc_info=True)
            raise Exception(error_msg)

    def _execute_call_tool(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Call a tool, validating against filtering rules"""
        tool_name = inputs.get("tool_name") or self.config.get("tool_name")
        arguments = inputs.get("arguments", {}).copy()

        # Inject auth credentials into tool arguments
        # MCP tools often require auth as function arguments, not just HTTP headers
        auth_type = self.config.get("authentication") or self.config.get(
            "_auth_type", "none"
        )

        if auth_type != "none":
            logger.info(f"Auth injection - auth_type: {auth_type}")
            if auth_type == "bearer":
                token = self.config.get("bearer_token")
                if token and "bearer_token" not in arguments:
                    arguments["bearer_token"] = token
            elif auth_type == "header":
                api_key = self.config.get("api_key") or self.config.get("header_value")

                # Also try to extract from headers_json (used by credential modal)
                if not api_key:
                    headers_json = self.config.get("headers_json")
                    if headers_json:
                        try:
                            if isinstance(headers_json, str):
                                headers_dict = json.loads(headers_json)
                            else:
                                headers_dict = headers_json
                            # Extract the first header value as api_key
                            # Common header names for API keys
                            for key in [
                                "X-API-Key",
                                "x-api-key",
                                "Authorization",
                                "Api-Key",
                                "api-key",
                            ]:
                                if key in headers_dict:
                                    api_key = headers_dict[key]
                                    break
                            # Fallback: use the first header value if no known key found
                            if not api_key and headers_dict:
                                api_key = list(headers_dict.values())[0]
                        except (json.JSONDecodeError, TypeError):
                            logger.warning(
                                "Failed to parse headers_json for auth injection"
                            )

                if api_key and "api_key" not in arguments:
                    arguments["api_key"] = api_key
            elif auth_type in ["oauth2", "mcp-oauth2"]:
                token = self.config.get("access_token")
                logger.info(
                    f"OAuth2 auth injection - token found: {bool(token)}, token: {token[:20] if token else 'None'}..."
                )
                if token and "access_token" not in arguments:
                    arguments["access_token"] = token
                    logger.info("Injected access_token into arguments")
            elif auth_type == "multiple-headers":
                # Inject all multi-header auth fields
                api_key = self.config.get("api_key")
                client_id = self.config.get("client_id")

                # Also check headers_json for X-API-Key and X-Client-ID
                headers_json = self.config.get("headers_json")
                if headers_json:
                    try:
                        headers = json.loads(headers_json)
                        if isinstance(headers, dict):
                            # Check for X-API-Key header
                            if not api_key:
                                api_key = headers.get("X-API-Key") or headers.get(
                                    "x-api-key"
                                )
                            # Check for X-Client-ID header
                            if not client_id:
                                client_id = headers.get("X-Client-ID") or headers.get(
                                    "x-client-id"
                                )
                    except json.JSONDecodeError:
                        logger.warning(
                            "Failed to parse headers_json for multiple-headers auth"
                        )

                logger.info(
                    f"Multiple-headers auth injection - api_key found: {bool(api_key)}, client_id found: {bool(client_id)}"
                )
                if api_key and "api_key" not in arguments:
                    arguments["api_key"] = api_key
                if client_id and "client_id" not in arguments:
                    arguments["client_id"] = client_id

        if not tool_name:
            raise ValueError("tool_name is required")

        # Validate Filtering
        tools_selection = self.config.get("tools_selection", "all")
        selected_list = self.config.get("tools_list", [])

        if tools_selection == "selected" and tool_name not in selected_list:
            raise ValueError(f"Tool '{tool_name}' is not in the allowed list.")
        if tools_selection == "all-except" and tool_name in selected_list:
            raise ValueError(f"Tool '{tool_name}' is currently excluded.")

        logger.info(f"Calling MCP tool: {tool_name}")

        try:
            return asyncio.run(
                self._run_async_operation(
                    "call_tool",
                    tool_name=tool_name,
                    arguments=arguments,
                )
            )
        except Exception as e:
            error_msg = f"MCP tool call failed: {str(e)}"
            logger.error(error_msg)
            return {"result": None, "error": error_msg}
