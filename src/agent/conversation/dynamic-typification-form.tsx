import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Check, Loader2, Sparkles, Undo2, X } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Badge } from '@/core/ui/badge';
import { Checkbox } from '@/core/ui/checkbox';
import { PhoneInput } from '@/core/ui/phone-input';
import { Textarea } from '@/core/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import { useConversationStore } from '@/agent/stores/conversation-store';
import {
  useTypificationForm,
  useTypify,
  useTypificationSuggestion,
  type TypificationCondition,
  type TypificationField,
  type TypificationNode,
} from '@/core/api/hooks/use-typification';

interface DynamicTypificationFormProps {
  readonly conversationId: string;
  readonly enabled?: boolean;
  readonly onCompleted?: () => void;
}

// ---------------------------------------------------------------------------
// Condition evaluator — client mirror of the server (UX only; the server
// re-validates authoritatively on /typify).
// ---------------------------------------------------------------------------

function evalCondition(
  expr: TypificationCondition,
  fieldValues: Record<string, string>,
  selectedNodeCodes: Set<string>,
): boolean {
  let left: string;
  if (expr.refType === 'NodeSelected') {
    left = selectedNodeCodes.has(expr.ref) ? 'true' : 'false';
  } else {
    left = fieldValues[expr.ref] ?? '';
  }
  const value = expr.value ?? '';

  switch (expr.op) {
    case 'Eq':
      return left === value;
    case 'Neq':
      return left !== value;
    case 'In':
      return value
        .split(',')
        .map((v) => v.trim())
        .includes(left);
    case 'Contains':
      return left.toLowerCase().includes(value.toLowerCase());
    case 'Exists':
      return left !== '';
    case 'GreaterThan': {
      const l = Number(left);
      const r = Number(value);
      if (Number.isNaN(l) || Number.isNaN(r)) return false;
      return l > r;
    }
    case 'LessThan': {
      const l = Number(left);
      const r = Number(value);
      if (Number.isNaN(l) || Number.isNaN(r)) return false;
      return l < r;
    }
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Subtree bindings: the cascade UI starts at the subtree root's CHILDREN (good
// UX), but the server validator requires the submitted path to begin at a true
// root. Walk parentNodeId from the subtree root up to the root and return the
// inclusive ancestor chain in root→leaf order ([root, ..., subtreeRoot]), so it
// can be prepended to the user-selected path. Guards against cycles and missing
// parents.
// ---------------------------------------------------------------------------

function ancestorChainInclusive(
  nodeById: Map<string, TypificationNode>,
  subtreeRootNodeId: string,
): string[] {
  const chain: string[] = [];
  const seen = new Set<string>();
  let current: string | undefined = subtreeRootNodeId;

  while (current != null && !seen.has(current)) {
    seen.add(current);
    const node = nodeById.get(current);
    if (node == null) break;
    chain.push(current);
    current = node.parentNodeId ?? undefined;
  }

  return chain.reverse();
}

// ---------------------------------------------------------------------------
// Seed the subtree-RELATIVE cascade selection from a server FULL root→leaf path.
// This is the exact inverse of `fullSelectedNodePath` (which prepends
// ancestorChainInclusive = [trueRoot, …, subtreeRoot]): with no subtree binding
// the full path IS the relative path; with a subtree binding we strip everything
// up to & including subtreeRootNodeId. Returns null when the path can't be mapped
// (empty, or the subtree root is absent from a subtree-bound full path) so the
// caller can leave the cascade untouched rather than seed a broken selection.
// Shared by the P1 prefill hydration AND the P2a AI-suggestion Accept action.
// ---------------------------------------------------------------------------

function relativeNodePathFromFull(
  fullPath: string[] | undefined,
  subtreeRootNodeId: string | undefined,
): string[] | null {
  if (fullPath == null || fullPath.length === 0) return null;
  if (subtreeRootNodeId == null) return fullPath;
  const rootIndex = fullPath.indexOf(subtreeRootNodeId);
  if (rootIndex < 0) return null;
  return fullPath.slice(rootIndex + 1);
}

// ---------------------------------------------------------------------------
// Field-level client validation (UX). Returns an error message key or null.
// ---------------------------------------------------------------------------

function validateFieldValue(field: TypificationField, value: string): string | null {
  if (value === '') return null; // emptiness is handled by the required gate separately
  const v = field.validation;
  if (!v) return null;

  if (v.maxLength != null && value.length > v.maxLength) {
    return 'typification.validation.maxLength';
  }
  if (v.regex != null && v.regex !== '') {
    try {
      if (!new RegExp(v.regex).test(value)) return 'typification.validation.pattern';
    } catch {
      // an invalid regex in the schema must not crash the agent UI
    }
  }
  if (v.min != null || v.max != null) {
    const n = Number(value);
    if (!Number.isNaN(n)) {
      if (v.min != null && n < v.min) return 'typification.validation.min';
      if (v.max != null && n > v.max) return 'typification.validation.max';
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Date prefill normalization. <input type="datetime-local"> only accepts a
// local, offset-less "YYYY-MM-DDTHH:mm" — it renders EMPTY for a UTC ISO instant
// (e.g. "2026-06-08T14:30:00Z" or with seconds/offset). The server may seed a
// Date field with a full instant, so convert it to the input's local format on
// hydration. A bare "YYYY-MM-DDTHH:mm" is already valid and passes through.
// ---------------------------------------------------------------------------

const DATE_TIME_PREFIX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const ZONE_OR_SECONDS = /^(:\d{2}(\.\d+)?|Z|[+-]\d{2}:?\d{2})/;

function isIsoInstant(value: string): boolean {
  // An instant carries a zone designator (Z / ±hh:mm) or seconds beyond the bare
  // "YYYY-MM-DDTHH:mm" the datetime-local control accepts. Require the date-time
  // prefix AND at least one of those extra markers immediately after it.
  if (!DATE_TIME_PREFIX.test(value)) return false;
  return ZONE_OR_SECONDS.test(value.slice(16));
}

function toDateTimeLocal(value: string): string {
  if (!isIsoInstant(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  // Format the LOCAL wall-clock time as "YYYY-MM-DDTHH:mm" for the input.
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

// ---------------------------------------------------------------------------
// Normalize suggested/prefilled field values: Date-typed keys may arrive as a
// UTC ISO instant, so convert them to the datetime-local format the <input>
// accepts. Shared by the AI Accept action and the C3 AutoFill path so both seed
// fields identically.
// ---------------------------------------------------------------------------

function normalizeSuggestedFieldValues(
  fields: TypificationField[],
  suggestedFieldValues: Record<string, string>,
): Record<string, string> {
  const dateFieldKeys = new Set(fields.filter((f) => f.type === 'Date').map((f) => f.key));
  const normalized: Record<string, string> = {};
  for (const [key, raw] of Object.entries(suggestedFieldValues)) {
    normalized[key] = dateFieldKeys.has(key) ? toDateTimeLocal(raw) : raw;
  }
  return normalized;
}

export function DynamicTypificationForm({
  conversationId,
  enabled = true,
  onCompleted,
}: DynamicTypificationFormProps) {
  const { t } = useTranslation('agent');
  const removeConversation = useConversationStore((s) => s.removeConversation);

  const { data: form, isLoading, isError } = useTypificationForm(conversationId, enabled);
  const typify = useTypify();
  const suggestion = useTypificationSuggestion();
  const { mutate: requestSuggestion } = suggestion;

  const [selectedNodePath, setSelectedNodePath] = useState<string[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');

  // --- P2a AI suggestion state ---------------------------------------------
  // `aiAccepted` flips true once the agent clicks Accept (it stays true even if
  // they subsequently tweak the cascade — keeping it simple per spec). The
  // confidence is remembered so the typify submit can echo it. `aiDismissed`
  // hides the banner when the agent declines and prevents it re-appearing.
  const [aiAccepted, setAiAccepted] = useState(false);
  const [aiConfidence, setAiConfidence] = useState<number | undefined>(undefined);
  const [aiDismissed, setAiDismissed] = useState(false);

  // --- C3 / P2b server-banded AutoFill state -------------------------------
  // When the server delivers a band of 'AutoFill' (and the form is untouched +
  // the suggestion is mappable) the cascade/fields are pre-filled automatically.
  // `autoApplied` drives the AutoFilled banner (mutually exclusive with the
  // Suggest banner). `undoSnapshot` captures whatever was in the form BEFORE the
  // auto-apply (empty, or a P1 prefill) so Undo can restore it. `formDirtyRef`
  // tracks genuine agent edits (anti-clobber) and `autoApplyDecidedKeyRef` is the
  // one-shot guard so the auto-apply decision runs exactly once per loaded form —
  // both refs (not state) so they never trigger a re-render, mirroring the
  // suggestionFiredKeyRef rationale.
  const [autoApplied, setAutoApplied] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState<{
    path: string[];
    fields: Record<string, string>;
  } | null>(null);
  const formDirtyRef = useRef(false);
  const autoApplyDecidedKeyRef = useRef<string | null>(null);

  const schema = form?.schema;

  // Index nodes by id and group by parent for O(1) cascade lookups.
  const { nodeById, childrenByParent, rootNodes } = useMemo(() => {
    const byId = new Map<string, TypificationNode>();
    const byParent = new Map<string, TypificationNode[]>();
    const roots: TypificationNode[] = [];

    if (schema) {
      for (const node of schema.nodes) {
        byId.set(node.nodeId, node);
      }
      for (const node of schema.nodes) {
        if (node.parentNodeId != null) {
          const bucket = byParent.get(node.parentNodeId) ?? [];
          bucket.push(node);
          byParent.set(node.parentNodeId, bucket);
        }
      }
      for (const bucket of byParent.values()) {
        bucket.sort((a, b) => a.sortOrder - b.sortOrder);
      }

      const subtreeRoot = form?.subtreeRootNodeId;
      if (subtreeRoot != null && byParent.has(subtreeRoot)) {
        roots.push(...(byParent.get(subtreeRoot) ?? []));
      } else if (subtreeRoot == null) {
        roots.push(...schema.nodes.filter((n) => n.parentNodeId == null));
      }
      roots.sort((a, b) => a.sortOrder - b.sortOrder);
    }

    return { nodeById: byId, childrenByParent: byParent, rootNodes: roots };
  }, [schema, form?.subtreeRootNodeId]);

  // Build the per-level option lists from the selected path. Level 0 = roots;
  // each subsequent level = the children of the previously selected node.
  const levels = useMemo(() => {
    const result: { options: TypificationNode[]; selected: string }[] = [];
    if (rootNodes.length === 0) return result;

    result.push({ options: rootNodes, selected: selectedNodePath[0] ?? '' });

    for (let i = 0; i < selectedNodePath.length; i += 1) {
      const nodeId = selectedNodePath[i];
      if (nodeId == null) break;
      const children = childrenByParent.get(nodeId) ?? [];
      if (children.length === 0) break; // selected a leaf — no further level
      result.push({ options: children, selected: selectedNodePath[i + 1] ?? '' });
    }

    return result;
  }, [rootNodes, childrenByParent, selectedNodePath]);

  // The full submit path: for subtree bindings the user-selected path starts at
  // the subtree root's child, so prepend the inclusive ancestor chain (true root
  // → subtreeRoot) to form a contiguous root→leaf chain the server accepts.
  const subtreeRootNodeId = form?.subtreeRootNodeId;
  const fullSelectedNodePath = useMemo(() => {
    if (subtreeRootNodeId == null) return selectedNodePath;
    return [...ancestorChainInclusive(nodeById, subtreeRootNodeId), ...selectedNodePath];
  }, [subtreeRootNodeId, nodeById, selectedNodePath]);

  // One-shot hydration from the server-provided prefill (M3): when the form data
  // first loads, seed the cascade selection + field values so the agent confirms
  // / adjusts rather than re-classifying. This is derived initial state (NOT an
  // external-system sync), so it uses React's sanctioned "adjust state during
  // render when an input changes" pattern (https://react.dev/learn/you-might-not-need-an-effect)
  // rather than an effect — keyed on the loaded form identity so it runs exactly
  // once per loaded form and never clobbers subsequent agent edits. The server
  // sends a FULL root→leaf prefilledNodePath while the UI tracks a subtree-
  // RELATIVE selectedNodePath, so hydration strips the ancestor prefix up to and
  // including subtreeRootNodeId — the exact inverse of fullSelectedNodePath
  // (which prepends ancestorChainInclusive = [trueRoot, …, subtreeRoot]).
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  if (form && schema) {
    const hydrationKey = `${conversationId}:${schema.schemaId}:${schema.version}`;
    if (hydratedKey !== hydrationKey) {
      setHydratedKey(hydrationKey);

      // Reset the P2a AI-suggestion overlay state alongside the P1 prefill: a
      // reused instance must not carry conversation-A's accepted suggestion or
      // dismissal into conversation-B.
      setAiAccepted(false);
      setAiConfidence(undefined);
      setAiDismissed(false);

      // Reset the C3 AutoFill overlay state too (the dirty-flag + one-shot-guard
      // REFS are reset in the keyed effect below — refs must not be mutated during
      // render): a reused instance must never leak conversation-A's auto-fill into
      // conversation-B.
      setAutoApplied(false);
      setUndoSnapshot(null);

      const prefilledPath = form.prefilledNodePath;
      const prefilledFieldValues = form.prefilledFieldValues;
      const hasPathPrefill = prefilledPath != null && prefilledPath.length > 0;
      const hasFieldPrefill =
        prefilledFieldValues != null && Object.keys(prefilledFieldValues).length > 0;

      // --- Cascade preselect (inverse of fullSelectedNodePath) ---------------
      if (hasPathPrefill) {
        // Defensive: relativeNodePathFromFull returns null if the server's full
        // path doesn't contain the subtree root (shouldn't happen — server
        // guarantees it); leave the cascade empty rather than seed a broken path.
        const relative = relativeNodePathFromFull(prefilledPath, subtreeRootNodeId);
        if (relative != null) {
          setSelectedNodePath(relative);
        }
      }

      // --- Field prefill (keyed by field Key, raw strings as the form stores) -
      // Date-typed fields may arrive as a UTC ISO instant; normalize them to the
      // datetime-local format ("YYYY-MM-DDTHH:mm") or the <input> renders empty.
      if (hasFieldPrefill) {
        const dateFieldKeys = new Set(
          schema.fields.filter((f) => f.type === 'Date').map((f) => f.key),
        );
        const normalized: Record<string, string> = {};
        for (const [key, raw] of Object.entries(prefilledFieldValues)) {
          normalized[key] = dateFieldKeys.has(key) ? toDateTimeLocal(raw) : raw;
        }
        setFieldValues((prev) => ({ ...normalized, ...prev }));
      }

      // --- Cross-conversation hardening (FIX 5) ------------------------------
      // When the hydration key changes to a form with NO prefill, defensively
      // clear any prior selection so a reused instance can't leak conversation-A
      // state into conversation-B. Only fires on key change (not every render),
      // so it never clobbers the current agent's in-progress edits.
      if (!hasPathPrefill && !hasFieldPrefill) {
        setSelectedNodePath([]);
        setFieldValues({});
        setNotes('');
      }
    }
  }

  // Reset the C3 anti-clobber REFS on each hydration-key change. Refs must NOT be
  // mutated during render (react-hooks/refs), so this lives in an effect keyed on
  // the committed hydratedKey. It is declared BEFORE the auto-apply effect so the
  // reset runs first on a key change (effects fire in declaration order), giving
  // the auto-apply decision a clean dirty-flag + one-shot guard for the new form.
  useEffect(() => {
    formDirtyRef.current = false;
    autoApplyDecidedKeyRef.current = null;
  }, [hydratedKey]);

  // Fire the AI disposition suggestion ONCE per loaded form (P2a). Modelled as a
  // mutation (it POSTs and triggers an LLM call) the form kicks off in an effect
  // guarded by a one-shot key held in a ref — a ref (not state) so the guard
  // never triggers a re-render/cascade, mirroring the intent of the hydration
  // one-shot above. The hook swallows 402 (unlicensed → empty) and any other
  // failure silently, so this never blocks manual wrap-up and never pops the
  // global upgrade modal.
  const suggestionFiredKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!form || !schema) return;
    const fireKey = `${conversationId}:${schema.schemaId}:${schema.version}`;
    if (suggestionFiredKeyRef.current === fireKey) return;
    suggestionFiredKeyRef.current = fireKey;
    requestSuggestion(conversationId);
  }, [form, schema, conversationId, requestSuggestion]);

  const suggestionData = suggestion.data;
  const suggestedNodePath = suggestionData?.suggestedNodePath;

  // C3 / P2b auto-apply decision — runs ONCE per loaded form when the suggestion
  // data arrives, guarded by a one-shot key ref so it can never re-clobber. We
  // auto-fill ONLY when the server says band='AutoFill', the agent hasn't touched
  // the form (anti-clobber), the suggested path is mappable into the cascade, and
  // there is a non-empty path. Otherwise we leave the existing Accept/Dismiss
  // banner path to handle it (degrade to Suggest UX). The band is treated as a
  // hard ceiling — an undefined/None/Suggest band never auto-applies.
  //
  // `selectedNodePath`/`fieldValues` are in the deps so the snapshot reads fresh
  // state, but the one-shot guard makes any extra re-runs no-ops (so an agent
  // edit before the suggestion arrives can't re-trigger an auto-apply).
  useEffect(() => {
    if (!form || !schema || suggestionData == null) return;
    const decideKey = `${conversationId}:${schema.schemaId}:${schema.version}`;
    if (autoApplyDecidedKeyRef.current === decideKey) return;

    const suggestedPath = suggestionData.suggestedNodePath;
    const relative = relativeNodePathFromFull(suggestedPath, subtreeRootNodeId);
    const mappable = relative != null;
    const shouldAutoApply =
      suggestionData.band === 'AutoFill' &&
      !formDirtyRef.current &&
      mappable &&
      suggestedPath != null &&
      suggestedPath.length > 0;

    // Mark decided in BOTH branches so the effect never re-runs / re-clobbers.
    autoApplyDecidedKeyRef.current = decideKey;
    if (!shouldAutoApply) return;

    // The autoApplyDecidedKeyRef one-shot guard means this fires at most once per
    // loaded form, so these setStates cannot cascade (mirrors the conversation-
    // panel wrap-up one-shot rationale).
    /* eslint-disable react-hooks/set-state-in-effect */
    // Snapshot the CURRENT state (empty, or a P1 prefill) so Undo restores it.
    // Copy BOTH the path array and the fields object so the snapshot can never
    // alias a later-mutated array/object (latent aliasing footgun; behavior same).
    setUndoSnapshot({ path: [...selectedNodePath], fields: { ...fieldValues } });

    // Apply the suggestion exactly as handleAcceptSuggestion does.
    if (relative != null) setSelectedNodePath(relative);
    if (suggestionData.suggestedFieldValues != null) {
      const normalized = normalizeSuggestedFieldValues(
        schema.fields,
        suggestionData.suggestedFieldValues,
      );
      setFieldValues((prev) => ({ ...prev, ...normalized }));
    }
    setAutoApplied(true);
    setAiConfidence(suggestionData.confidence);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [
    form,
    schema,
    conversationId,
    suggestionData,
    subtreeRootNodeId,
    selectedNodePath,
    fieldValues,
  ]);

  const hasSuggestion =
    !aiDismissed &&
    !aiAccepted &&
    !autoApplied &&
    suggestedNodePath != null &&
    suggestedNodePath.length > 0 &&
    // The suggested path must be mappable into the cascade (subtree-aware) or it
    // can't be applied — treat an unmappable suggestion as no suggestion.
    relativeNodePathFromFull(suggestedNodePath, subtreeRootNodeId) != null;

  // Human-readable labels for the suggested cascade path (resolve node ids).
  const suggestedPathLabels = useMemo(() => {
    if (suggestedNodePath == null) return [];
    return suggestedNodePath.map((id) => nodeById.get(id)?.label ?? id);
  }, [suggestedNodePath, nodeById]);

  function handleAcceptSuggestion() {
    if (suggestionData == null) return;
    const relative = relativeNodePathFromFull(suggestionData.suggestedNodePath, subtreeRootNodeId);
    if (relative != null) {
      setSelectedNodePath(relative);
    }
    // Seed field values from the suggestion (Date fields normalized like prefill).
    const suggestedFieldValues = suggestionData.suggestedFieldValues;
    if (suggestedFieldValues != null && schema != null) {
      const normalized = normalizeSuggestedFieldValues(schema.fields, suggestedFieldValues);
      // Overwrite with the AI suggestion — the agent explicitly chose to accept.
      setFieldValues((prev) => ({ ...prev, ...normalized }));
    }
    setAiAccepted(true);
    setAiConfidence(suggestionData.confidence);
  }

  function handleDismissSuggestion() {
    setAiDismissed(true);
  }

  // Undo a C3 AutoFill: restore the pre-fill snapshot (empty, or a P1 prefill).
  // It is a revert, NOT an agent classification, so it must NOT set formDirtyRef
  // and must NOT set aiDismissed — once autoApplied flips back to false and the
  // (still-present, mappable) suggestion stands, the Accept/Dismiss banner
  // reappears so the agent can re-Accept.
  function handleUndoAutoFill() {
    if (undoSnapshot != null) {
      setSelectedNodePath(undoSnapshot.path);
      setFieldValues(undoSnapshot.fields);
    }
    setAutoApplied(false);
    setUndoSnapshot(null);
  }

  // Condition evaluation must mirror the server: include the prepended ancestor
  // node codes so NodeSelected conditions referencing them behave identically.
  const selectedNodeCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const id of fullSelectedNodePath) {
      const node = nodeById.get(id);
      if (node) codes.add(node.code);
    }
    return codes;
  }, [fullSelectedNodePath, nodeById]);

  const lastSelectedNodeId = selectedNodePath.at(-1);
  const lastSelectedNode =
    lastSelectedNodeId != null && lastSelectedNodeId !== ''
      ? nodeById.get(lastSelectedNodeId)
      : undefined;
  const pathEndsAtLeaf = lastSelectedNode?.isLeaf === true;

  // Active fields: attached to a node on the (full) path (or unattached) AND
  // passing their visibility condition. Uses the full path so fields attached to
  // a subtree-root ancestor still activate, mirroring the server.
  const activeFields = useMemo(() => {
    if (!schema) return [];
    return [...schema.fields]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter((field) => {
        const attachOk =
          field.attachToNodeId == null || fullSelectedNodePath.includes(field.attachToNodeId);
        if (!attachOk) return false;
        if (field.visibleWhen == null) return true;
        return evalCondition(field.visibleWhen, fieldValues, selectedNodeCodes);
      });
  }, [schema, fullSelectedNodePath, fieldValues, selectedNodeCodes]);

  // Submit gate: must end at a leaf, all active required fields must be filled,
  // and no active field may have a client validation error.
  const requiredMissing = activeFields.some(
    (f) => f.required && (fieldValues[f.key] ?? '').trim() === '',
  );
  const hasValidationError = activeFields.some(
    (f) => validateFieldValue(f, fieldValues[f.key] ?? '') != null,
  );
  const canSubmit = pathEndsAtLeaf && !requiredMissing && !hasValidationError;

  function handleSelectNode(levelIndex: number, nodeId: string) {
    // A genuine agent edit -> mark the form dirty so a later AutoFill suggestion
    // can't clobber the agent's in-progress classification (anti-clobber).
    formDirtyRef.current = true;
    setSelectedNodePath((prev) => {
      // Replace at this level and reset all deeper levels.
      const next = prev.slice(0, levelIndex);
      if (nodeId !== '') next.push(nodeId);
      return next;
    });
  }

  function setFieldValue(key: string, value: string) {
    // A genuine agent edit -> anti-clobber (see handleSelectNode).
    formDirtyRef.current = true;
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    if (!canSubmit) return;

    // Date fields use <input type="datetime-local"> which yields a local,
    // offset-less value (e.g. "2026-06-08T14:30"). Convert each non-empty Date
    // field to a full UTC ISO-8601 instant so the server schedules at the right
    // time. Non-Date fields and empty values are left untouched.
    const dateFieldKeys = new Set(
      (schema?.fields ?? []).filter((f) => f.type === 'Date').map((f) => f.key),
    );
    const submittedFieldValues: Record<string, string> = { ...fieldValues };
    for (const key of dateFieldKeys) {
      const raw = submittedFieldValues[key];
      if (raw != null && raw !== '') {
        submittedFieldValues[key] = new Date(raw).toISOString();
      }
    }

    typify.mutate(
      {
        conversationId,
        selectedNodePath: fullSelectedNodePath,
        fieldValues: submittedFieldValues,
        notes,
        // P2a/C3 AI flags: when the agent accepted an AI suggestion OR an
        // un-undone C3 AutoFill stands, mark the disposition as AI-sourced
        // (Source=AutoAi server-side) and echo the confidence + acceptance. When
        // neither holds, send the explicit negative so the server records a
        // manual disposition. (The server is authoritative on provenance now and
        // treats these as hints, but keep them honest.)
        aiSuggested: aiAccepted || autoApplied,
        aiConfidence: aiAccepted || autoApplied ? aiConfidence : undefined,
        aiAccepted: aiAccepted || autoApplied,
      },
      {
        onSuccess: () => {
          removeConversation(conversationId);
          toast.success(t('wrap_up.success'));
          onCompleted?.();
        },
        // Errors (incl. 400 server validation) surface via the global toast in useTypify.
      },
    );
  }

  // --- Loading state -------------------------------------------------------
  if (isLoading) {
    return (
      <div
        className="flex flex-1 items-center justify-center py-10 text-muted-foreground"
        data-testid="typification-loading"
      >
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  // --- No schema bound (404 / missing) -> friendly state, typify disabled ---
  if (isError || !schema) {
    return (
      <div className="flex flex-col gap-4 px-4" data-testid="typification-no-schema">
        <p className="text-sm text-muted-foreground">{t('typification.no_schema')}</p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wrapup-notes">{t('wrap_up.notes')}</Label>
          <Textarea
            id="wrapup-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('wrap_up.notes_placeholder')}
            rows={4}
            data-testid="typification-notes"
          />
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() => onCompleted?.()}
            variant="outline"
            data-testid="typification-close"
          >
            {t('conversation.cancel')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
      data-testid="typification-form"
    >
      {/* AI analyzing indicator — unobtrusive, only while the suggestion is in
          flight and nothing has been surfaced or dismissed yet. */}
      {suggestion.isPending && !aiAccepted && !aiDismissed && (
        <div
          className="flex items-center gap-2 text-xs text-muted-foreground"
          data-testid="typification-ai-analyzing"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t('typification.ai.analyzing')}
        </div>
      )}

      {/* C3 AutoFilled banner — the server delivered band='AutoFill' and the
          form was pre-filled automatically. Mutually exclusive with the Suggest
          banner (hasSuggestion requires !autoApplied). Undo reverts to the
          pre-fill snapshot and brings the Suggest banner back. */}
      {autoApplied && (
        <div
          className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3"
          data-testid="typification-ai-autofilled"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            {t('typification.ai.auto_applied', {
              percent: Math.round((aiConfidence ?? 0) * 100),
            })}
          </span>
          {aiConfidence != null && (
            <Badge variant="secondary" data-testid="typification-ai-confidence">
              {t('typification.ai.confidence', {
                percent: Math.round(aiConfidence * 100),
              })}
            </Badge>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={handleUndoAutoFill}
            data-testid="typification-ai-undo"
          >
            <Undo2 className="mr-1 h-3.5 w-3.5" />
            {t('typification.ai.undo')}
          </Button>
        </div>
      )}

      {/* AI suggestion banner — agent-triggered overlay. Accept seeds the
          cascade + fields (reusing the prefill seeding); Dismiss hides it. */}
      {hasSuggestion && (
        <div
          className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3"
          data-testid="typification-ai-suggestion"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{t('typification.ai.title')}</span>
            {suggestionData?.confidence != null && (
              <Badge variant="secondary" data-testid="typification-ai-confidence">
                {t('typification.ai.confidence', {
                  percent: Math.round(suggestionData.confidence * 100),
                })}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground" data-testid="typification-ai-path">
            {suggestedPathLabels.join(' › ')}
          </p>
          {suggestionData?.sentiment != null && suggestionData.sentiment !== '' && (
            <p className="text-xs text-muted-foreground" data-testid="typification-ai-sentiment">
              {t('typification.ai.sentiment', {
                sentiment: t(`typification.ai.sentiments.${suggestionData.sentiment}`, {
                  // Humanize the raw wire token (snake_case → spaced) so an
                  // unexpected value never surfaces a literal server token.
                  defaultValue: suggestionData.sentiment.replace(/_/g, ' '),
                }),
              })}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleAcceptSuggestion}
              data-testid="typification-ai-accept"
            >
              <Check className="mr-1 h-3.5 w-3.5" />
              {t('typification.ai.accept')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleDismissSuggestion}
              data-testid="typification-ai-dismiss"
            >
              <X className="mr-1 h-3.5 w-3.5" />
              {t('typification.ai.dismiss')}
            </Button>
          </div>
        </div>
      )}

      {/* Cascading node selectors (depth-aware) */}
      {levels.map((level, levelIndex) => (
        <div className="flex flex-col gap-1.5" key={`level-${levelIndex}`}>
          <Label htmlFor={`typification-node-${levelIndex}`} required={levelIndex === 0}>
            {levelIndex === 0
              ? t('typification.outcome')
              : t('typification.refine', { level: levelIndex + 1 })}
          </Label>
          <select
            id={`typification-node-${levelIndex}`}
            data-testid={`typification-node-${levelIndex}`}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            value={level.selected}
            onChange={(e) => handleSelectNode(levelIndex, e.target.value)}
          >
            <option value="">{t('typification.select_outcome')}</option>
            {level.options.map((node) => (
              <option key={node.nodeId} value={node.nodeId}>
                {node.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      {/* Conditional fields */}
      {activeFields.map((field) => (
        <FieldRenderer
          key={field.fieldId}
          field={field}
          value={fieldValues[field.key] ?? ''}
          onChange={(v) => setFieldValue(field.key, v)}
          errorKey={validateFieldValue(field, fieldValues[field.key] ?? '')}
        />
      ))}

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wrapup-notes">{t('wrap_up.notes')}</Label>
        <Textarea
          id="wrapup-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('wrap_up.notes_placeholder')}
          rows={4}
          data-testid="typification-notes"
        />
      </div>

      {/* Submit */}
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="outline" onClick={() => onCompleted?.()} data-testid="typification-cancel">
          {t('conversation.cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || typify.isPending}
          data-testid="typification-submit"
        >
          {t('wrap_up.submit')}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field renderer — one ACTIVE field, dispatched by type.
// ---------------------------------------------------------------------------

interface FieldRendererProps {
  readonly field: TypificationField;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly errorKey: string | null;
}

function FieldRenderer({ field, value, onChange, errorKey }: FieldRendererProps) {
  const { t } = useTranslation('agent');
  const inputId = `typification-field-${field.fieldId}`;

  function renderControl() {
    switch (field.type) {
      case 'Textarea':
        return (
          <Textarea
            id={inputId}
            data-testid={`typification-field-${field.key}`}
            value={value}
            rows={3}
            maxLength={field.validation?.maxLength}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case 'Number':
        return (
          <Input
            id={inputId}
            data-testid={`typification-field-${field.key}`}
            type="number"
            value={value}
            min={field.validation?.min}
            max={field.validation?.max}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case 'Date':
        return (
          <Input
            id={inputId}
            data-testid={`typification-field-${field.key}`}
            type="datetime-local"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case 'Boolean':
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              id={inputId}
              data-testid={`typification-field-${field.key}`}
              checked={value === 'true'}
              onCheckedChange={(checked) => onChange(checked ? 'true' : 'false')}
            />
            <Label htmlFor={inputId} className="font-normal">
              {field.label}
            </Label>
          </div>
        );
      case 'Select':
        return (
          <Select value={value === '' ? undefined : value} onValueChange={(v) => onChange(v ?? '')}>
            <SelectTrigger className="w-full" data-testid={`typification-field-${field.key}`}>
              <SelectValue placeholder={t('typification.select_value')} />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'MultiSelect': {
        const selected = new Set(
          value
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
        );
        return (
          <div
            className="flex flex-col gap-1.5 rounded-lg border border-input p-2"
            data-testid={`typification-field-${field.key}`}
          >
            {(field.options ?? []).map((opt) => {
              const optionId = `${inputId}-${opt.value}`;
              return (
                <div className="flex items-center gap-2" key={opt.value}>
                  <Checkbox
                    id={optionId}
                    data-option={opt.value}
                    checked={selected.has(opt.value)}
                    onCheckedChange={(checked) => {
                      const next = new Set(selected);
                      if (checked) next.add(opt.value);
                      else next.delete(opt.value);
                      onChange([...next].join(','));
                    }}
                  />
                  <Label htmlFor={optionId} className="font-normal">
                    {opt.label}
                  </Label>
                </div>
              );
            })}
          </div>
        );
      }
      case 'Phone':
        return (
          <PhoneInput
            value={value}
            onChange={onChange}
            data-testid={`typification-field-${field.key}`}
          />
        );
      case 'Text':
      case 'Lookup':
      default:
        return (
          <Input
            id={inputId}
            data-testid={`typification-field-${field.key}`}
            type="text"
            value={value}
            maxLength={field.validation?.maxLength}
            onChange={(e) => onChange(e.target.value)}
          />
        );
    }
  }

  return (
    <div className="flex flex-col gap-1.5" data-field-key={field.key}>
      {/* Boolean renders its own inline label next to the checkbox. */}
      {field.type !== 'Boolean' && (
        <Label htmlFor={inputId} required={field.required}>
          {field.label}
        </Label>
      )}
      {renderControl()}
      {errorKey && (
        <p className="text-xs text-destructive" data-testid={`typification-error-${field.key}`}>
          {t(errorKey)}
        </p>
      )}
    </div>
  );
}
