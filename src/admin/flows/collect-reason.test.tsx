import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { Node } from '@xyflow/react';

import CollectReasonNode from './nodes/collect-reason-node';
import PropertyPanel from './property-panel';
import type { TypificationSchema } from '@/core/api/hooks/use-typification';

// i18n: render keys verbatim so assertions are locale-proof.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// React Flow's <Handle> needs the store context; stub it to a marker so the
// node component can render in isolation (we assert on body content, not wiring).
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react');
  return {
    ...actual,
    Handle: ({ id }: { id?: string }) => <div data-testid={`handle-${id ?? 'default'}`} />,
  };
});

const SCHEMA: TypificationSchema = {
  schemaId: 'schema-1',
  name: 'Sales Outcomes',
  version: 3,
  isPublished: true,
  maxDepth: 4,
  nodes: [],
  fields: [],
  createdAt: '2026-06-01T00:00:00Z',
};

const useTypificationSchemasMock = vi.fn();
vi.mock('@/core/api/hooks/use-typification', () => ({
  useTypificationSchemas: () => useTypificationSchemasMock(),
}));

function makeNode(data: Record<string, unknown> = {}): Node {
  return { id: 'n1', type: 'CollectReason', position: { x: 0, y: 0 }, data };
}

describe('CollectReasonNode', () => {
  it('CollectReasonNode_ShouldRenderWithoutCrashing_WhenGivenTypicalData', () => {
    render(
      <CollectReasonNode
        id="n1"
        type="CollectReason"
        data={{ schema_id: 'schema-1', subtree_root_node_id: 'node-7' }}
        selected={false}
        dragging={false}
        zIndex={0}
        isConnectable
        positionAbsoluteX={0}
        positionAbsoluteY={0}
        deletable
        selectable
        draggable
      />,
    );

    expect(screen.getByText('flows.node_types.collect_reason')).toBeInTheDocument();
    expect(screen.getByText('schema-1')).toBeInTheDocument();
    // Both edge handles (collected + error) are rendered.
    expect(screen.getByTestId('handle-collected')).toBeInTheDocument();
    expect(screen.getByTestId('handle-error')).toBeInTheDocument();
  });
});

describe('PropertyPanel (collect_reason)', () => {
  it('PropertyPanel_ShouldRenderSchemaPicker_WhenNodeIsCollectReason', () => {
    useTypificationSchemasMock.mockReturnValue({ data: [SCHEMA], isLoading: false });

    render(<PropertyPanel node={makeNode()} onUpdate={vi.fn()} />);

    // Schema picker (a native <select>) is rendered with the schema label key.
    const picker = screen.getByLabelText('flows.fields.schema_id');
    expect(picker).toBeInTheDocument();
    expect(picker.tagName).toBe('SELECT');
    // The loaded schema appears as an option.
    expect(screen.getByRole('option', { name: 'Sales Outcomes (v3)' })).toBeInTheDocument();
    // The other config fields are present too.
    expect(screen.getByLabelText('flows.fields.subtree_root_node_id')).toBeInTheDocument();
    expect(screen.getByLabelText('flows.fields.max_retries')).toBeInTheDocument();
  });
});
