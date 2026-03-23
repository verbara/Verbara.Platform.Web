import type { PropsWithChildren } from 'react';
import { Handle, Position } from '@xyflow/react';

// ---------------------------------------------------------------------------
// BaseNode — shared wrapper for all custom flow nodes
// ---------------------------------------------------------------------------

interface BaseNodeProps {
  /** Header label */
  title: string;
  /** Tailwind bg class for the header stripe, e.g. "bg-blue-500" */
  headerColor: string;
  /** Whether the node is currently selected on the canvas */
  selected?: boolean;
  /** Render top input handle (default true) */
  showInput?: boolean;
  /** Render bottom output handle (default true) */
  showOutput?: boolean;
}

export default function BaseNode({
  title,
  headerColor,
  selected,
  showInput = true,
  showOutput = true,
  children,
}: PropsWithChildren<BaseNodeProps>) {
  return (
    <div
      className={`w-[180px] rounded-lg border bg-background shadow-sm transition-shadow ${
        selected ? 'ring-2 ring-primary shadow-md' : ''
      }`}
    >
      {/* Input handle */}
      {showInput && (
        <Handle
          type="target"
          position={Position.Top}
          className="!h-2.5 !w-2.5 !border-2 !border-background !bg-muted-foreground"
        />
      )}

      {/* Header */}
      <div
        className={`rounded-t-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white ${headerColor}`}
      >
        {title}
      </div>

      {/* Body */}
      <div className="px-3 py-2 text-xs text-foreground">{children}</div>

      {/* Output handle */}
      {showOutput && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-2.5 !w-2.5 !border-2 !border-background !bg-muted-foreground"
        />
      )}
    </div>
  );
}
