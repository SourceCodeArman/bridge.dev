# HTTP Connector

Example connector implementation for Bridge.dev demonstrating how to build connectors.

## Features

- Supports HTTP methods: GET, POST, PUT, DELETE, PATCH
- Configurable headers, body, and query parameters
- URL templating support
- Response parsing (JSON or text)
- Error handling with detailed messages

## Usage

### In Workflow Definition

```json
{
  "nodes": [
    {
      "id": "http_step",
      "type": "http",
      "data": {
        "action_id": "request",
        "url": "https://api.example.com/data",
        "method": "GET",
        "headers": {
          "Authorization": "Bearer {{credential.token}}"
        }
      }
    }
  ]
}
```

### With Credentials

The connector can use credentials from the credential vault:

```json
{
  "credential_id": "uuid-of-credential",
  "url": "https://api.example.com/data",
  "method": "GET"
}
```

## Implementation Notes

This connector serves as a reference implementation for:

1. **Manifest Definition**: Shows how to define connector capabilities
2. **BaseConnector Extension**: Demonstrates implementing `_initialize()` and `_execute()`
3. **Input/Output Validation**: Uses JSON schemas for validation
4. **Error Handling**: Proper exception handling and logging
5. **Configuration**: How to use credentials and config from the vault

## Registration

To use this connector, register it in your application:

```python
from apps.core.connectors.base import ConnectorRegistry
from apps.core.connectors.examples.http_connector import HTTPConnector

registry = ConnectorRegistry()
registry.register(HTTPConnector)
```

