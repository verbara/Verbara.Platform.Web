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
// Node type vocabulary: React Flow render keys (PascalCase) ↔ engine/wire
// node types (snake_case). The wire/engine vocabulary is snake_case (the
// backend flow engine matches handlers by snake_case name); PascalCase exists
// only so React Flow can resolve the right node component. This map is the
// single source of truth bridging the two.
// ---------------------------------------------------------------------------

const NODE_TYPE_TO_WIRE: Record<string, string> = {
  SendMessage: 'send_message',
  CollectInput: 'collect_input',
  Condition: 'condition',
  SetVariable: 'set_variable',
  Wait: 'wait',
  End: 'end',
  Enqueue: 'enqueue',
  HttpRequest: 'http_request',
  KnowledgeSearch: 'knowledge_search',
  AiClassify: 'ai_classify',
  AiGenerate: 'ai_generate',
  CollectReason: 'collect_reason',
};

const WIRE_TO_NODE_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(NODE_TYPE_TO_WIRE).map(([k, v]) => [v, k]),
);

export { NODE_TYPE_TO_WIRE, WIRE_TO_NODE_TYPE };

/**
 * Map a React Flow render key (PascalCase) to the engine/wire node type
 * (snake_case). Falls back to the input unchanged for unknown/custom types so
 * non-standard nodes never break round-tripping.
 */
export function toWireType(renderType: string): string {
  return NODE_TYPE_TO_WIRE[renderType] ?? renderType;
}

/**
 * Map an engine/wire node type (snake_case) to the React Flow render key
 * (PascalCase). Falls back to the input unchanged for unknown/custom types.
 */
export function toRenderType(wireType: string): string {
  return WIRE_TO_NODE_TYPE[wireType] ?? wireType;
}

// ---------------------------------------------------------------------------
// Domain FlowDefinition → React Flow nodes/edges
// ---------------------------------------------------------------------------

export function toReactFlow(flow: FlowDefinition): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = flow.nodes.map((n, i) => ({
    id: n.nodeId,
    type: toRenderType(n.type),
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
    type: toWireType(n.type ?? 'default'),
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
