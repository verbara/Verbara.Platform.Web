import { type Node, type Edge } from '@xyflow/react';

// ---------------------------------------------------------------------------
// Domain types (mirrors Platform API FlowDefinition DTOs)
// ---------------------------------------------------------------------------

export interface FlowEdgeDto {
  condition: string;
  targetNodeId: string;
}

export interface FlowNodeDto {
  nodeId: string;
  type: string;
  config: Record<string, string>;
  edges: FlowEdgeDto[];
}

export interface FlowDefinition {
  flowId: string;
  name: string;
  nodes: FlowNodeDto[];
}

// ---------------------------------------------------------------------------
// Domain FlowDefinition → React Flow nodes/edges
// ---------------------------------------------------------------------------

export function toReactFlow(flow: FlowDefinition): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = flow.nodes.map((n, i) => ({
    id: n.nodeId,
    type: n.type,
    position:
      n.config['_x'] && n.config['_y']
        ? { x: parseFloat(n.config['_x']), y: parseFloat(n.config['_y']) }
        : { x: 100, y: i * 120 },
    data: { ...n.config, nodeId: n.nodeId },
  }));

  const edges: Edge[] = flow.nodes.flatMap((n) =>
    n.edges.map((e) => ({
      id: `${n.nodeId}-${e.targetNodeId}`,
      source: n.nodeId,
      target: e.targetNodeId,
      label: e.condition !== 'default' ? e.condition : undefined,
    })),
  );

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// React Flow nodes/edges → Domain FlowDefinition nodes
// ---------------------------------------------------------------------------

export function toDomain(nodes: Node[], edges: Edge[]): FlowNodeDto[] {
  return nodes.map((n) => ({
    nodeId: n.id,
    type: n.type ?? 'default',
    config: {
      ...(n.data as Record<string, string>),
      _x: String(n.position.x),
      _y: String(n.position.y),
    },
    edges: edges
      .filter((e) => e.source === n.id)
      .map((e) => ({
        condition: (e.label as string) ?? 'default',
        targetNodeId: e.target,
      })),
  }));
}
