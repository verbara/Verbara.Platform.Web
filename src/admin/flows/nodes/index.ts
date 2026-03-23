import type { NodeTypes } from '@xyflow/react';

import SendMessageNode from './send-message-node';
import CollectInputNode from './collect-input-node';
import ConditionNode from './condition-node';
import SetVariableNode from './set-variable-node';
import WaitNode from './wait-node';
import EndNode from './end-node';
import EnqueueNode from './enqueue-node';
import HttpRequestNode from './http-request-node';
import KnowledgeSearchNode from './knowledge-search-node';
import AiClassifyNode from './ai-classify-node';
import AiGenerateNode from './ai-generate-node';

// ---------------------------------------------------------------------------
// Node type registry — pass to <ReactFlow nodeTypes={nodeTypes} />
// ---------------------------------------------------------------------------

export const nodeTypes: NodeTypes = {
  SendMessage: SendMessageNode,
  CollectInput: CollectInputNode,
  Condition: ConditionNode,
  SetVariable: SetVariableNode,
  Wait: WaitNode,
  End: EndNode,
  Enqueue: EnqueueNode,
  HttpRequest: HttpRequestNode,
  KnowledgeSearch: KnowledgeSearchNode,
  AiClassify: AiClassifyNode,
  AiGenerate: AiGenerateNode,
};
