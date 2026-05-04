// AGENT ASSIST: deferred to v1.7.0+ as 8-layer cross-repo activation project.
// This page is retained as scaffolding but is NOT reachable from navigation.
// Backend is dead code: engine is disabled in Program.cs (no SpeechRecognizer),
// AgentAssistConfigStore is a sealed in-memory singleton that nothing consumes,
// KeywordSuggestionProvider is instantiated with empty list, session stores are
// empty at runtime. Saves from this page have zero runtime effect.
// Full activation spec: memory/project_agent_assist_deferred.md
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Plus, Pencil, Trash2, Save, X, Check } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Badge } from '@/core/ui/badge';
import { Switch } from '@/core/ui/switch';
import { Checkbox } from '@/core/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import {
  useAgentAssistConfig,
  useUpdateAgentAssistConfig,
  useKeywordRules,
  useUpdateKeywordRules,
  useComplianceRules,
  useUpdateComplianceRules,
  type AgentAssistConfig,
  type KeywordRule,
  type ComplianceRule,
} from '@/core/api/hooks/use-agent-assist';
import { useQueues } from '@/core/api/hooks/use-queues';
import { useAgents } from '@/core/api/hooks/use-agents';

const PRIORITY_OPTIONS = ['Informational', 'Important', 'Urgent', 'Critical'] as const;
type Priority = (typeof PRIORITY_OPTIONS)[number];

const SEVERITY_OPTIONS = ['Info', 'Warning', 'Critical'] as const;
type Severity = (typeof SEVERITY_OPTIONS)[number];

const ACTION_OPTIONS = ['Alert', 'Block', 'Log'] as const;
type Action = (typeof ACTION_OPTIONS)[number];

function SectionCard({
  title,
  description,
  children,
  testId,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm" data-testid={testId}>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const { t } = useTranslation(['admin']);
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[32px]">
        {selected.length === 0 ? (
          <span className="text-sm text-muted-foreground italic">{placeholder}</span>
        ) : (
          selected.map((v) => {
            const opt = options.find((o) => o.value === v);
            return (
              <span
                key={v}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
              >
                {opt?.label ?? v}
                <button
                  type="button"
                  onClick={() => toggle(v)}
                  className="ml-0.5 rounded-full hover:text-primary/70"
                  aria-label={`Remove ${opt?.label ?? v}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })
        )}
      </div>
      <div className="max-h-48 overflow-y-auto rounded-md border bg-background p-2 space-y-1">
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1 py-0.5">
            {t('admin:agentAssist.noOptionsAvailable')}
          </p>
        ) : (
          options.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted"
            >
              <Checkbox
                checked={selected.includes(opt.value)}
                onCheckedChange={() => toggle(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

interface RuleRowEdit {
  keyword: string;
  suggestionText: string;
  priority: Priority;
}

function KeywordRulesSection() {
  const { t } = useTranslation(['admin']);
  const { data: rules = [], isLoading } = useKeywordRules();
  const updateRules = useUpdateKeywordRules();

  const [localRules, setLocalRules] = useState<KeywordRule[]>(rules);
  const [prevRules, setPrevRules] = useState(rules);
  if (prevRules !== rules) {
    setPrevRules(rules);
    setLocalRules(rules);
  }

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<RuleRowEdit>({
    keyword: '',
    suggestionText: '',
    priority: 'Informational',
  });
  const [addingNew, setAddingNew] = useState(false);
  const [newDraft, setNewDraft] = useState<RuleRowEdit>({
    keyword: '',
    suggestionText: '',
    priority: 'Informational',
  });

  const startEdit = (rule: KeywordRule) => {
    setEditingId(rule.id);
    setEditDraft({
      keyword: rule.keyword,
      suggestionText: rule.suggestionText,
      priority: rule.priority as Priority,
    });
    setAddingNew(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = () => {
    if (!editingId) return;
    setLocalRules((prev) => prev.map((r) => (r.id === editingId ? { ...r, ...editDraft } : r)));
    setEditingId(null);
  };

  const deleteRule = (id: string) => {
    if (!window.confirm(t('admin:agentAssist.rules.deleteConfirm'))) return;
    setLocalRules((prev) => prev.filter((r) => r.id !== id));
  };

  const startAddNew = () => {
    setAddingNew(true);
    setNewDraft({ keyword: '', suggestionText: '', priority: 'Informational' });
    setEditingId(null);
  };

  const cancelAddNew = () => {
    setAddingNew(false);
  };

  const confirmAddNew = () => {
    if (!newDraft.keyword.trim()) return;
    const newRule: KeywordRule = {
      id: `new-${Date.now()}`,
      keyword: newDraft.keyword.trim(),
      suggestionText: newDraft.suggestionText.trim(),
      priority: newDraft.priority,
      isActive: true,
    };
    setLocalRules((prev) => [...prev, newRule]);
    setAddingNew(false);
  };

  const handleSaveRules = () => {
    updateRules.mutate(localRules);
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('common:status.loading')}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                {t('admin:agentAssist.rules.keyword')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                {t('admin:agentAssist.rules.suggestionText')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                {t('admin:agentAssist.rules.priority')}
              </th>
              <th className="w-24 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {localRules.length === 0 && !addingNew && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  {t('admin:agentAssist.rules.empty')}
                </td>
              </tr>
            )}
            {localRules.map((rule) =>
              editingId === rule.id ? (
                <tr key={rule.id} className="border-b bg-muted/30">
                  <td className="px-3 py-2">
                    <Input
                      value={editDraft.keyword}
                      onChange={(e) => setEditDraft((d) => ({ ...d, keyword: e.target.value }))}
                      className="h-7 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={editDraft.suggestionText}
                      onChange={(e) =>
                        setEditDraft((d) => ({ ...d, suggestionText: e.target.value }))
                      }
                      className="h-7 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={editDraft.priority}
                      onValueChange={(v) =>
                        setEditDraft((d) => ({ ...d, priority: v as Priority }))
                      }
                    >
                      <SelectTrigger size="sm" className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={saveEdit}
                        className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
                        aria-label={t('admin:agentAssist.aria.confirmEdit')}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={cancelEdit}
                        className="h-7 w-7 p-0"
                        aria-label={t('admin:agentAssist.aria.cancelEdit')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={rule.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium text-foreground">{rule.keyword}</td>
                  <td className="px-3 py-2 text-muted-foreground">{rule.suggestionText}</td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={
                        rule.priority === 'Critical'
                          ? 'destructive'
                          : rule.priority === 'Urgent'
                            ? 'default'
                            : 'secondary'
                      }
                    >
                      {rule.priority}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(rule)}
                        className="h-7 w-7 p-0"
                        aria-label={t('admin:agentAssist.aria.editRule')}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteRule(rule.id)}
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        aria-label={t('admin:agentAssist.aria.deleteRule')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ),
            )}

            {/* New row */}
            {addingNew && (
              <tr className="border-b bg-muted/30">
                <td className="px-3 py-2">
                  <Input
                    value={newDraft.keyword}
                    onChange={(e) => setNewDraft((d) => ({ ...d, keyword: e.target.value }))}
                    placeholder={t('admin:agentAssist.rules.keywordPlaceholder')}
                    className="h-7 text-sm"
                    autoFocus
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={newDraft.suggestionText}
                    onChange={(e) => setNewDraft((d) => ({ ...d, suggestionText: e.target.value }))}
                    placeholder={t('admin:agentAssist.rules.suggestionPlaceholder')}
                    className="h-7 text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <Select
                    value={newDraft.priority}
                    onValueChange={(v) => setNewDraft((d) => ({ ...d, priority: v as Priority }))}
                  >
                    <SelectTrigger size="sm" className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={confirmAddNew}
                      className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
                      aria-label={t('admin:agentAssist.aria.addRule')}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={cancelAddNew}
                      className="h-7 w-7 p-0"
                      aria-label={t('admin:agentAssist.aria.cancel')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={startAddNew}
          disabled={addingNew}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:agentAssist.rules.addRule')}
        </Button>

        <Button type="button" size="sm" onClick={handleSaveRules} disabled={updateRules.isPending}>
          <Save className="mr-1.5 h-4 w-4" />
          {updateRules.isPending
            ? t('admin:agentAssist.saving')
            : t('admin:agentAssist.rules.saveRules')}
        </Button>
      </div>
    </div>
  );
}

interface ComplianceRowEdit {
  pattern: string;
  severity: Severity;
  action: Action;
  description: string;
}

function ComplianceRulesSection() {
  const { t } = useTranslation(['admin']);
  const { data: rules = [], isLoading } = useComplianceRules();
  const updateRules = useUpdateComplianceRules();

  const [localRules, setLocalRules] = useState<ComplianceRule[]>(rules);
  const [prevRules, setPrevRules] = useState(rules);
  if (prevRules !== rules) {
    setPrevRules(rules);
    setLocalRules(rules);
  }

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ComplianceRowEdit>({
    pattern: '',
    severity: 'Warning',
    action: 'Alert',
    description: '',
  });
  const [addingNew, setAddingNew] = useState(false);
  const [newDraft, setNewDraft] = useState<ComplianceRowEdit>({
    pattern: '',
    severity: 'Warning',
    action: 'Alert',
    description: '',
  });

  const startEdit = (rule: ComplianceRule) => {
    setEditingId(rule.ruleId);
    setEditDraft({
      pattern: rule.pattern,
      severity: rule.severity,
      action: rule.action,
      description: rule.description ?? '',
    });
    setAddingNew(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = () => {
    if (!editingId) return;
    setLocalRules((prev) =>
      prev.map((r) =>
        r.ruleId === editingId
          ? {
              ...r,
              pattern: editDraft.pattern,
              severity: editDraft.severity,
              action: editDraft.action,
              description: editDraft.description || undefined,
            }
          : r,
      ),
    );
    setEditingId(null);
  };

  const deleteRule = (ruleId: string) => {
    if (!window.confirm(t('admin:agentAssist.complianceRules.deleteConfirm'))) return;
    setLocalRules((prev) => prev.filter((r) => r.ruleId !== ruleId));
  };

  const startAddNew = () => {
    setAddingNew(true);
    setNewDraft({ pattern: '', severity: 'Warning', action: 'Alert', description: '' });
    setEditingId(null);
  };

  const cancelAddNew = () => {
    setAddingNew(false);
  };

  const confirmAddNew = () => {
    if (!newDraft.pattern.trim()) return;
    const newRule: ComplianceRule = {
      ruleId: `cr-${Date.now()}`,
      pattern: newDraft.pattern.trim(),
      severity: newDraft.severity,
      action: newDraft.action,
      description: newDraft.description.trim() || undefined,
    };
    setLocalRules((prev) => [...prev, newRule]);
    setAddingNew(false);
  };

  const handleSaveRules = () => {
    updateRules.mutate(localRules);
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('common:status.loading')}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                {t('admin:agentAssist.complianceRules.pattern')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                {t('admin:agentAssist.complianceRules.severity')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                {t('admin:agentAssist.complianceRules.action')}
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                {t('admin:agentAssist.complianceRules.description')}
              </th>
              <th className="w-24 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {localRules.length === 0 && !addingNew && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  {t('admin:agentAssist.complianceRules.empty')}
                </td>
              </tr>
            )}
            {localRules.map((rule) =>
              editingId === rule.ruleId ? (
                <tr key={rule.ruleId} className="border-b bg-muted/30">
                  <td className="px-3 py-2">
                    <Input
                      value={editDraft.pattern}
                      onChange={(e) => setEditDraft((d) => ({ ...d, pattern: e.target.value }))}
                      className="h-7 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={editDraft.severity}
                      onValueChange={(v) =>
                        setEditDraft((d) => ({ ...d, severity: v as Severity }))
                      }
                    >
                      <SelectTrigger size="sm" className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEVERITY_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={editDraft.action}
                      onValueChange={(v) => setEditDraft((d) => ({ ...d, action: v as Action }))}
                    >
                      <SelectTrigger size="sm" className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTION_OPTIONS.map((a) => (
                          <SelectItem key={a} value={a}>
                            {a}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={editDraft.description}
                      onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                      className="h-7 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={saveEdit}
                        className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
                        aria-label={t('admin:agentAssist.aria.confirmEdit')}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={cancelEdit}
                        className="h-7 w-7 p-0"
                        aria-label={t('admin:agentAssist.aria.cancelEdit')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={rule.ruleId} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium text-foreground">{rule.pattern}</td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={
                        rule.severity === 'Critical'
                          ? 'destructive'
                          : rule.severity === 'Warning'
                            ? 'default'
                            : 'secondary'
                      }
                    >
                      {rule.severity}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">{rule.action}</Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{rule.description ?? '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(rule)}
                        className="h-7 w-7 p-0"
                        aria-label={t('admin:agentAssist.aria.editRule')}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteRule(rule.ruleId)}
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        aria-label={t('admin:agentAssist.aria.deleteRule')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ),
            )}

            {/* New row */}
            {addingNew && (
              <tr className="border-b bg-muted/30">
                <td className="px-3 py-2">
                  <Input
                    value={newDraft.pattern}
                    onChange={(e) => setNewDraft((d) => ({ ...d, pattern: e.target.value }))}
                    placeholder={t('admin:agentAssist.complianceRules.patternPlaceholder')}
                    className="h-7 text-sm"
                    autoFocus
                  />
                </td>
                <td className="px-3 py-2">
                  <Select
                    value={newDraft.severity}
                    onValueChange={(v) => setNewDraft((d) => ({ ...d, severity: v as Severity }))}
                  >
                    <SelectTrigger size="sm" className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEVERITY_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Select
                    value={newDraft.action}
                    onValueChange={(v) => setNewDraft((d) => ({ ...d, action: v as Action }))}
                  >
                    <SelectTrigger size="sm" className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_OPTIONS.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={newDraft.description}
                    onChange={(e) => setNewDraft((d) => ({ ...d, description: e.target.value }))}
                    placeholder={t('admin:agentAssist.complianceRules.descriptionPlaceholder')}
                    className="h-7 text-sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={confirmAddNew}
                      className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
                      aria-label={t('admin:agentAssist.aria.addRule')}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={cancelAddNew}
                      className="h-7 w-7 p-0"
                      aria-label={t('admin:agentAssist.aria.cancel')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={startAddNew}
          disabled={addingNew}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:agentAssist.complianceRules.addRule')}
        </Button>

        <Button type="button" size="sm" onClick={handleSaveRules} disabled={updateRules.isPending}>
          <Save className="mr-1.5 h-4 w-4" />
          {updateRules.isPending
            ? t('admin:agentAssist.saving')
            : t('admin:agentAssist.complianceRules.saveRules')}
        </Button>
      </div>
    </div>
  );
}

interface ConfigFormState {
  enabled: boolean;
  suggestionTimeoutMs: number;
  sentimentTimeoutMs: number;
  complianceTimeoutMs: number;
  queueNames: string[];
  agentIds: string[];
  whisperEnabled: boolean;
  whisperPriorityThreshold: Priority;
  whisperQueueCapacity: number;
}

const DEFAULT_CONFIG: ConfigFormState = {
  enabled: true,
  suggestionTimeoutMs: 3000,
  sentimentTimeoutMs: 500,
  complianceTimeoutMs: 200,
  queueNames: [],
  agentIds: [],
  whisperEnabled: true,
  whisperPriorityThreshold: 'Informational',
  whisperQueueCapacity: 8,
};

export default function AgentAssistConfigPage() {
  const { t } = useTranslation(['admin']);
  const { data: config, isLoading } = useAgentAssistConfig();
  const updateConfig = useUpdateAgentAssistConfig();
  const { data: queues = [] } = useQueues();
  const { data: agents = [] } = useAgents();

  const [form, setForm] = useState<ConfigFormState>(DEFAULT_CONFIG);
  const [dirty, setDirty] = useState(false);

  // Sync server config into editable local form when it (re)loads. Legitimate
  // because we need to overwrite both `form` and `dirty` after a successful
  // refetch/save round-trip.
  useEffect(() => {
    if (config) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setForm((prev) => ({
        ...prev,
        enabled: config.enabled,
        suggestionTimeoutMs: config.suggestionTimeoutMs,
        sentimentTimeoutMs: config.sentimentTimeoutMs,
        complianceTimeoutMs: config.complianceTimeoutMs,
        queueNames: config.queueNames ?? [],
      }));
      setDirty(false);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [config]);

  const update = <K extends keyof ConfigFormState>(key: K, value: ConfigFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    const payload: Partial<AgentAssistConfig> = {
      enabled: form.enabled,
      suggestionTimeoutMs: form.suggestionTimeoutMs,
      sentimentTimeoutMs: form.sentimentTimeoutMs,
      complianceTimeoutMs: form.complianceTimeoutMs,
      queueNames: form.queueNames,
    };
    updateConfig.mutate(payload);
    setDirty(false);
  };

  const queueOptions = queues.map((q) => ({ value: q.name, label: q.name }));
  const agentOptions = agents.map((a) => ({ value: a.id, label: a.displayName }));

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-semibold">{t('admin:agentAssist.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('admin:agentAssist.description')}</p>
          </div>
        </div>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          {t('common:status.loading')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="agent-assist-config-page">
      {/* Coming Soon banner */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
          Coming Soon — Agent Assist requires speech recognition configuration. This feature will be
          available in a future release.
        </p>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-semibold">{t('admin:agentAssist.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('admin:agentAssist.description')}</p>
        </div>
      </div>

      <fieldset disabled className="space-y-6 opacity-50 pointer-events-none">
        {/* Section 1 — Engine Status */}
        <SectionCard
          title={t('admin:agentAssist.status.title')}
          description={t('admin:agentAssist.status.description')}
          testId="agent-assist-section-status"
        >
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{t('admin:agentAssist.status.enableLabel')}</p>
              <p className="text-xs text-muted-foreground">
                {t('admin:agentAssist.status.enableHint')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={form.enabled ? 'default' : 'secondary'}>
                {form.enabled
                  ? t('admin:agentAssist.status.active')
                  : t('admin:agentAssist.status.inactive')}
              </Badge>
              <Switch
                checked={form.enabled}
                onCheckedChange={(checked) => update('enabled', checked)}
                aria-label={t('admin:agentAssist.aria.engineEnabled')}
              />
            </div>
          </div>
        </SectionCard>

        {/* Section 2 — Filters */}
        <SectionCard
          title={t('admin:agentAssist.filters.title')}
          description={t('admin:agentAssist.filters.description')}
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>{t('admin:agentAssist.filters.queues')}</Label>
              <MultiSelect
                options={queueOptions}
                selected={form.queueNames}
                onChange={(v) => update('queueNames', v)}
                placeholder={t('admin:agentAssist.filters.allCalls')}
              />
              <p className="text-xs text-muted-foreground">
                {t('admin:agentAssist.filters.emptyNote')}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t('admin:agentAssist.filters.agents')}</Label>
              <MultiSelect
                options={agentOptions}
                selected={form.agentIds}
                onChange={(v) => update('agentIds', v)}
                placeholder={t('admin:agentAssist.filters.allAgents')}
              />
              <p className="text-xs text-muted-foreground">
                {t('admin:agentAssist.filters.emptyNote')}
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Section 3 — Timeouts */}
        <SectionCard
          title={t('admin:agentAssist.timeouts.title')}
          description={t('admin:agentAssist.timeouts.description')}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="suggestionTimeout">
                {t('admin:agentAssist.timeouts.suggestion')}
              </Label>
              <Input
                id="suggestionTimeout"
                type="number"
                min={100}
                step={100}
                value={form.suggestionTimeoutMs}
                onChange={(e) => update('suggestionTimeoutMs', Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">ms</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sentimentTimeout">{t('admin:agentAssist.timeouts.sentiment')}</Label>
              <Input
                id="sentimentTimeout"
                type="number"
                min={100}
                step={100}
                value={form.sentimentTimeoutMs}
                onChange={(e) => update('sentimentTimeoutMs', Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">ms</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="complianceTimeout">
                {t('admin:agentAssist.timeouts.compliance')}
              </Label>
              <Input
                id="complianceTimeout"
                type="number"
                min={100}
                step={100}
                value={form.complianceTimeoutMs}
                onChange={(e) => update('complianceTimeoutMs', Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">ms</p>
            </div>
          </div>
        </SectionCard>

        {/* Section 4 — Whisper */}
        <SectionCard
          title={t('admin:agentAssist.whisper.title')}
          description={t('admin:agentAssist.whisper.description')}
        >
          <div className="space-y-5">
            {/* Enable toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{t('admin:agentAssist.whisper.enableLabel')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('admin:agentAssist.whisper.enableHint')}
                </p>
              </div>
              <Switch
                checked={form.whisperEnabled}
                onCheckedChange={(checked) => update('whisperEnabled', checked)}
                aria-label={t('admin:agentAssist.aria.whisperEnabled')}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Priority threshold */}
              <div className="space-y-1.5">
                <Label htmlFor="whisperPriority">
                  {t('admin:agentAssist.whisper.priorityThreshold')}
                </Label>
                <Select
                  value={form.whisperPriorityThreshold}
                  onValueChange={(v) => update('whisperPriorityThreshold', v as Priority)}
                >
                  <SelectTrigger id="whisperPriority" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('admin:agentAssist.whisper.priorityHint')}
                </p>
              </div>

              {/* Queue capacity */}
              <div className="space-y-1.5">
                <Label htmlFor="whisperCapacity">
                  {t('admin:agentAssist.whisper.queueCapacity')}
                </Label>
                <Input
                  id="whisperCapacity"
                  type="number"
                  min={1}
                  max={100}
                  value={form.whisperQueueCapacity}
                  onChange={(e) => update('whisperQueueCapacity', Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  {t('admin:agentAssist.whisper.capacityHint')}
                </p>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Save button for sections 1-4 */}
        <div className="flex justify-end">
          <Button type="button" onClick={handleSave} disabled={!dirty || updateConfig.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {updateConfig.isPending
              ? t('admin:agentAssist.saving')
              : t('admin:agentAssist.saveConfig')}
          </Button>
        </div>

        {/* Section 5 — Keyword Rules */}
        <SectionCard
          title={t('admin:agentAssist.rules.title')}
          description={t('admin:agentAssist.rules.description')}
          testId="agent-assist-section-keyword-rules"
        >
          <KeywordRulesSection />
        </SectionCard>

        {/* Section 6 — Compliance Rules */}
        <SectionCard
          title={t('admin:agentAssist.complianceRules.title')}
          description={t('admin:agentAssist.complianceRules.description')}
          testId="agent-assist-section-compliance-rules"
        >
          <ComplianceRulesSection />
        </SectionCard>
      </fieldset>
    </div>
  );
}
