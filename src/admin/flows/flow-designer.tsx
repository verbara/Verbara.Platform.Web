import { useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  type OnConnect,
  type Node,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// ---------------------------------------------------------------------------
// Flow Designer — full-width canvas with node palette + property panel
// ---------------------------------------------------------------------------

export default function FlowDesigner() {
  const [nodes, , onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const onConnect: OnConnect = useCallback(
    (connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  );

  const handleSelectionChange = useCallback(
    ({ nodes: selected }: { nodes: Node[] }) => {
      setSelectedNodeId(selected.length === 1 ? (selected[0]?.id ?? null) : null);
    },
    [],
  );

  return (
    <div className="flex h-full w-full">
      {/* Left — Node palette */}
      <aside className="flex w-[200px] shrink-0 flex-col border-r border-border bg-muted/30 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Nodes
        </h3>
        <p className="text-xs text-muted-foreground">
          Drag node types here (coming soon)
        </p>
      </aside>

      {/* Center — React Flow canvas */}
      <div className="relative flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={handleSelectionChange}
          snapToGrid
          snapGrid={[16, 16]}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls />
        </ReactFlow>
      </div>

      {/* Right — Property panel */}
      {selectedNodeId && (
        <aside className="flex w-[300px] shrink-0 flex-col border-l border-border bg-muted/30 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Properties
          </h3>
          <p className="text-xs text-muted-foreground">
            Node: {selectedNodeId}
          </p>
        </aside>
      )}
    </div>
  );
}
