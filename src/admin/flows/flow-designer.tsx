import { useCallback, useRef, useState, type DragEvent } from 'react';
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
import { nodeTypes } from './nodes';
import NodePalette from './node-palette';
import PropertyPanel from './property-panel';
import FlowToolbar from './flow-toolbar';

// ---------------------------------------------------------------------------
// Flow Designer — full-width canvas with node palette + property panel
// ---------------------------------------------------------------------------

let nextId = 1;
function generateId() {
  return `node_${nextId++}`;
}

export default function FlowDesigner() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [flowName, setFlowName] = useState('Untitled Flow');
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

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

  // -----------------------------------------------------------------------
  // Drag-and-drop from palette onto canvas
  // -----------------------------------------------------------------------

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const nodeType = event.dataTransfer.getData('application/reactflow');
      if (!nodeType) return;

      // Calculate drop position relative to the React Flow pane
      const wrapperBounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!wrapperBounds) return;

      const position = {
        x: event.clientX - wrapperBounds.left,
        y: event.clientY - wrapperBounds.top,
      };

      const newNode: Node = {
        id: generateId(),
        type: nodeType,
        position,
        data: {},
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes],
  );

  // -----------------------------------------------------------------------
  // Property panel — update node data
  // -----------------------------------------------------------------------

  const handleNodeDataUpdate = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data } : n)),
      );
    },
    [setNodes],
  );

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  return (
    <div className="flex h-full w-full flex-col">
      <FlowToolbar
        flowName={flowName}
        version={1}
        isPublished={false}
        onNameChange={setFlowName}
      />
      <div className="flex min-h-0 flex-1">
      {/* Left — Node palette */}
      <NodePalette />

      {/* Center — React Flow canvas */}
      <div className="relative flex-1" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={handleSelectionChange}
          onDragOver={onDragOver}
          onDrop={onDrop}
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
      {selectedNode && (
        <PropertyPanel node={selectedNode} onUpdate={handleNodeDataUpdate} />
      )}
      </div>
    </div>
  );
}
