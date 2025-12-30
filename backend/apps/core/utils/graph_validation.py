"""
Graph validation utilities for workflow definitions.

Validates workflow graphs for cycles, node validity, and edge compatibility.
"""
from typing import Dict, Any, List
from apps.common.logging_utils import get_logger

logger = get_logger(__name__)


def validate_workflow_graph(definition: Dict[str, Any]) -> tuple[bool, List[str]]:
    """
    Validate a workflow graph definition.
    
    Args:
        definition: Workflow definition (nodes and edges)
        
    Returns:
        Tuple of (is_valid, list_of_errors)
    """
    errors = []
    
    nodes = definition.get('nodes', [])
    edges = definition.get('edges', [])
    
    # Check for cycles
    has_cycle, cycle_error = detect_cycles(nodes, edges)
    if has_cycle:
        errors.append(cycle_error)
    
    # Validate nodes
    node_errors = validate_nodes(nodes)
    errors.extend(node_errors)
    
    # Validate edges
    edge_errors = validate_edges(nodes, edges)
    errors.extend(edge_errors)
    
    return (len(errors) == 0, errors)


def detect_cycles(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> tuple[bool, str]:
    """
    Detect cycles in workflow graph using DFS.
    
    Args:
        nodes: List of node definitions
        edges: List of edge definitions
        
    Returns:
        Tuple of (has_cycle, error_message)
    """
    # Build adjacency list
    graph = {}
    node_ids = {node.get('id') for node in nodes}
    
    for node_id in node_ids:
        graph[node_id] = []
    
    for edge in edges:
        source = edge.get('source')
        target = edge.get('target')
        if source and target:
            if source not in graph:
                graph[source] = []
            graph[source].append(target)
    
    # DFS to detect cycles
    visited = set()
    rec_stack = set()
    
    def has_cycle_dfs(node_id: str) -> bool:
        """DFS helper to detect cycles"""
        visited.add(node_id)
        rec_stack.add(node_id)
        
        for neighbor in graph.get(node_id, []):
            if neighbor not in visited:
                if has_cycle_dfs(neighbor):
                    return True
            elif neighbor in rec_stack:
                return True
        
        rec_stack.remove(node_id)
        return False
    
    # Check all nodes
    for node_id in node_ids:
        if node_id not in visited:
            if has_cycle_dfs(node_id):
                return (True, f"Cycle detected in workflow graph involving node {node_id}")
    
    return (False, "")


def validate_nodes(nodes: List[Dict[str, Any]]) -> List[str]:
    """
    Validate node definitions.
    
    Args:
        nodes: List of node definitions
        
    Returns:
        List of error messages
    """
    errors = []
    node_ids = set()
    
    for i, node in enumerate(nodes):
        node_id = node.get('id')
        
        # Check for required fields
        if not node_id:
            errors.append(f"Node at index {i} missing 'id' field")
            continue
        
        # Check for duplicate IDs
        if node_id in node_ids:
            errors.append(f"Duplicate node ID: {node_id}")
        else:
            node_ids.add(node_id)
        
        # Check for node type
        if not node.get('type'):
            errors.append(f"Node {node_id} missing 'type' field")
        
        # Check for data field
        if 'data' not in node:
            errors.append(f"Node {node_id} missing 'data' field")
    
    return errors


def validate_edges(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> List[str]:
    """
    Validate edge definitions and compatibility.
    
    Args:
        nodes: List of node definitions
        edges: List of edge definitions
        
    Returns:
        List of error messages
    """
    errors = []
    node_ids = {node.get('id') for node in nodes}
    
    for i, edge in enumerate(edges):
        source = edge.get('source')
        target = edge.get('target')
        
        # Check for required fields
        if not source:
            errors.append(f"Edge at index {i} missing 'source' field")
            continue
        
        if not target:
            errors.append(f"Edge at index {i} missing 'target' field")
            continue
        
        # Check that source and target nodes exist
        if source not in node_ids:
            errors.append(f"Edge {i}: source node '{source}' does not exist")
        
        if target not in node_ids:
            errors.append(f"Edge {i}: target node '{target}' does not exist")
        
        # Check for self-loops (optional - might be allowed)
        if source == target:
            errors.append(f"Edge {i}: self-loop detected (node '{source}' connects to itself)")
    
    return errors


def validate_node_configuration(node: Dict[str, Any], connector_manifest: Dict[str, Any]) -> tuple[bool, List[str]]:
    """
    Validate node configuration against connector manifest.
    
    Args:
        node: Node definition
        connector_manifest: Connector manifest
        
    Returns:
        Tuple of (is_valid, list_of_errors)
    """
    errors = []
    node_data = node.get('data', {})
    action_id = node_data.get('action_id')
    
    # Check if action exists in manifest
    actions = connector_manifest.get('actions', [])
    if actions:
        action_ids = [a.get('id') for a in actions]
        if action_id and action_id not in action_ids:
            errors.append(f"Action '{action_id}' not found in connector manifest")
        
        # Validate required fields
        if action_id:
            action = next((a for a in actions if a.get('id') == action_id), None)
            if action:
                required_fields = action.get('required_fields', [])
                for field in required_fields:
                    if field not in node_data:
                        errors.append(f"Required field '{field}' missing in node configuration")
    
    return (len(errors) == 0, errors)


