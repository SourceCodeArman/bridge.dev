#!/usr/bin/env python
"""
Test script to verify AI assistant connector context fix.
Run this inside the Django shell to verify connectors are loaded correctly.
"""

import django

django.setup()

from apps.core.workflow_generator import WorkflowGenerator
from apps.core.models import Connector, CustomConnector

print("=" * 60)
print("AI ASSISTANT CONNECTOR CONTEXT VERIFICATION")
print("=" * 60)

# Test 1: Check database connectors
print("\n1. Database Connectors:")
db_connector_count = Connector.objects.filter(is_active=True).count()
print(f"   Active connectors in database: {db_connector_count}")

if db_connector_count > 0:
    sample_connectors = Connector.objects.filter(is_active=True)[:5]
    print("   Sample connectors:")
    for conn in sample_connectors:
        print(f"     - {conn.display_name} (slug: {conn.slug})")

# Test 2: Check custom connectors
print("\n2. Custom Connectors:")
custom_connector_count = CustomConnector.objects.filter(status="approved").count()
print(f"   Approved custom connectors: {custom_connector_count}")

if custom_connector_count > 0:
    sample_custom = CustomConnector.objects.filter(status="approved")[:3]
    print("   Sample custom connectors:")
    for conn in sample_custom:
        print(f"     - {conn.display_name} (slug: {conn.slug})")

# Test 3: Test WorkflowGenerator
print("\n3. WorkflowGenerator Connector Loading:")
generator = WorkflowGenerator()

# Test without workspace_id
connectors_no_workspace = generator._get_connectors_info()
print(f"   Without workspace_id: {len(connectors_no_workspace)} connectors")

# Count by source
sources = {}
for c in connectors_no_workspace:
    source = c.get("source", "unknown")
    sources[source] = sources.get(source, 0) + 1

print(f"   Breakdown by source:")
for source, count in sources.items():
    print(f"     - {source}: {count}")

# Test with workspace_id (if any workspace exists)
from apps.accounts.models import Workspace

workspace = Workspace.objects.first()

if workspace:
    print(f"\n4. With Workspace Context (workspace: {workspace.name}):")
    connectors_with_workspace = generator._get_connectors_info(
        workspace_id=str(workspace.id)
    )
    print(f"   Total connectors: {len(connectors_with_workspace)}")

    sources_workspace = {}
    for c in connectors_with_workspace:
        source = c.get("source", "unknown")
        sources_workspace[source] = sources_workspace.get(source, 0) + 1

    print(f"   Breakdown by source:")
    for source, count in sources_workspace.items():
        print(f"     - {source}: {count}")

    # Show sample connector IDs
    print(f"\n   Sample connector IDs available to AI:")
    for i, conn in enumerate(connectors_with_workspace[:10]):
        print(f"     {i + 1}. {conn['id']} - {conn['name']}")
else:
    print("\n4. No workspace found - skipping workspace-specific test")

print("\n" + "=" * 60)
print("VERIFICATION COMPLETE")
print("=" * 60)
print("\nSUMMARY:")
print(f"✓ Database connectors: {db_connector_count}")
print(f"✓ Custom connectors: {custom_connector_count}")
print(f"✓ Total connectors loaded: {len(connectors_no_workspace)}")
print("\nThe AI assistant now has access to all these connectors!")
print("=" * 60)
