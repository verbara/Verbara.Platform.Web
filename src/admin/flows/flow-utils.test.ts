import { describe, it, expect } from 'vitest';
import { type Node, type Edge } from '@xyflow/react';

import { toWireType, toRenderType, toReactFlow, toDomain, type FlowDefinition } from './flow-utils';

describe('toWireType', () => {
  it('toWireType_ShouldMapPascalToSnake_WhenKnownType', () => {
    expect(toWireType('CollectInput')).toBe('collect_input');
    expect(toWireType('CollectReason')).toBe('collect_reason');
    expect(toWireType('SendMessage')).toBe('send_message');
    expect(toWireType('HttpRequest')).toBe('http_request');
  });

  it('toWireType_ShouldReturnInputUnchanged_WhenUnknownType', () => {
    expect(toWireType('default')).toBe('default');
    expect(toWireType('CustomNode')).toBe('CustomNode');
  });
});

describe('toRenderType', () => {
  it('toRenderType_ShouldMapSnakeToPascal_WhenKnownType', () => {
    expect(toRenderType('collect_input')).toBe('CollectInput');
    expect(toRenderType('collect_reason')).toBe('CollectReason');
    expect(toRenderType('send_message')).toBe('SendMessage');
    expect(toRenderType('http_request')).toBe('HttpRequest');
  });

  it('toRenderType_ShouldReturnInputUnchanged_WhenUnknownType', () => {
    expect(toRenderType('default')).toBe('default');
    expect(toRenderType('custom_node')).toBe('custom_node');
  });
});

describe('flowUtils round-trip', () => {
  it('flowUtils_ShouldRoundTripNodeTypeCasing_WhenToDomainThenToReactFlow', () => {
    // Wire (snake_case) → React Flow → back to wire must preserve snake_case.
    const flow: FlowDefinition = {
      flowId: 'flow-1',
      name: 'Test Flow',
      nodes: [
        {
          nodeId: 'n1',
          type: 'send_message',
          config: { _x: '100', _y: '0' },
          edges: [{ condition: 'default', targetNodeId: 'n2' }],
        },
        {
          nodeId: 'n2',
          type: 'collect_input',
          config: { _x: '100', _y: '120' },
          edges: [{ condition: 'default', targetNodeId: 'n3' }],
        },
        {
          nodeId: 'n3',
          type: 'collect_reason',
          config: { _x: '100', _y: '240' },
          edges: [],
        },
      ],
    };

    const { nodes, edges } = toReactFlow(flow);

    // React Flow render keys are PascalCase.
    expect(nodes.map((n) => n.type)).toEqual(['SendMessage', 'CollectInput', 'CollectReason']);

    const domain = toDomain(nodes, edges);

    // Back on the wire, types are snake_case again — identical to the source.
    expect(domain.map((n) => n.type)).toEqual(['send_message', 'collect_input', 'collect_reason']);
  });

  it('flowUtils_ShouldRoundTripPascalCase_WhenToDomainThenToReactFlow', () => {
    // React Flow node graph (PascalCase) → domain (snake_case) → back to
    // React Flow must restore PascalCase render keys.
    const rfNodes: Node[] = [
      { id: 'a', type: 'Condition', position: { x: 10, y: 20 }, data: {} },
      { id: 'b', type: 'Enqueue', position: { x: 30, y: 40 }, data: {} },
    ];
    const rfEdges: Edge[] = [{ id: 'a-b', source: 'a', target: 'b' }];

    const domain = toDomain(rfNodes, rfEdges);
    expect(domain.map((n) => n.type)).toEqual(['condition', 'enqueue']);

    const flow: FlowDefinition = {
      flowId: 'f',
      name: 'n',
      nodes: domain,
    };
    const { nodes } = toReactFlow(flow);
    expect(nodes.map((n) => n.type)).toEqual(['Condition', 'Enqueue']);
  });

  it('toDomain_ShouldFallBackToSnakeDefault_WhenNodeTypeMissing', () => {
    const rfNodes: Node[] = [{ id: 'x', type: undefined, position: { x: 0, y: 0 }, data: {} }];
    const domain = toDomain(rfNodes, []);
    // Unknown 'default' falls through unchanged (defensive).
    expect(domain[0]?.type).toBe('default');
  });
});
