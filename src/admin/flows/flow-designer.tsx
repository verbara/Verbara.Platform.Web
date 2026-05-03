import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  type OnConnect,
  type Node,
  type Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from './nodes';
import NodePalette from './node-palette';
import PropertyPanel from './property-panel';
import FlowToolbar from './flow-toolbar';
import { useFlow, useUpdateFlow, usePublishFlow } from '@/core/api/hooks/use-flows';
import { toReactFlow, toDomain } from './flow-utils';

// ---------------------------------------------------------------------------
// Flow Designer — full-width canvas with node palette + property panel
// ---------------------------------------------------------------------------

let nextId = 1;
function generateId() {
  return `node_${nextId++}`;
}

export default function FlowDesigner() {
  const { t } = useTranslation('admin');
  const { flowId } = useParams<{ flowId: string }>();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([] as Edge[]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [flowName, setFlowName] = useState(t('flows.untitled'));
  const [version, setVersion] = useState(1);
  const [isPublished, setIsPublished] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const { data: flow } = useFlow(flowId);
  const updateFlow = useUpdateFlow();
  const publishFlow = usePublishFlow();

  // Load flow data when it arrives from API. Legitimate sync of remote data into
  // multiple local-state slots (nodes/edges live in xyflow internals, plus name,
  // version, published). Cannot model as derived state because user edits diverge
  // from server values.
  useEffect(() => {
    if (flow) {
      const { nodes: rfNodes, edges: rfEdges } = toReactFlow(flow);
      /* eslint-disable react-hooks/set-state-in-effect */
      setNodes(rfNodes);
      setEdges(rfEdges);
      setFlowName(flow.name);
      setVersion(flow.version);
      setIsPublished(flow.isPublished);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [flow, setNodes, setEdges]);

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

  // -----------------------------------------------------------------------
  // Save & Publish
  // -----------------------------------------------------------------------

  const handleSave = useCallback(() => {
    if (!flowId) return;
    const domainNodes = toDomain(nodes, edges);
    updateFlow.mutate({
      id: flowId,
      name: flowName,
      nodes: domainNodes,
    });
  }, [flowId, flowName, nodes, edges, updateFlow]);

  const handlePublish = useCallback(() => {
    if (!flowId) return;
    // Save first, then publish
    const domainNodes = toDomain(nodes, edges);
    updateFlow.mutate(
      { id: flowId, name: flowName, nodes: domainNodes },
      {
        onSuccess: () => {
          publishFlow.mutate(flowId, {
            onSuccess: () => setIsPublished(true),
          });
        },
      },
    );
  }, [flowId, flowName, nodes, edges, updateFlow, publishFlow]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  return (
    <div className="flex h-full w-full flex-col">
      <FlowToolbar
        flowName={flowName}
        version={version}
        isPublished={isPublished}
        onNameChange={setFlowName}
        onSave={handleSave}
        onPublish={handlePublish}
        isSaving={updateFlow.isPending}
        isPublishing={publishFlow.isPending}
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
