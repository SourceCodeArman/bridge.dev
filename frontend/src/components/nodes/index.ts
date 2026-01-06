// Node components barrel export
export { SmartPlusHandle } from './SmartPlusHandle';
export { UnifiedNode, getNodeTypeConfig } from './UnifiedNode';

// Re-export node types data for external use
import nodeTypesData from './node-types.json';
import type { NodeTypesData } from '@/types/nodes';

export const nodeTypeConfigs = (nodeTypesData as NodeTypesData).nodeTypes;
