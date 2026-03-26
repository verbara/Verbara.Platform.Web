import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPlus, Trash2, X } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Label } from '@/core/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/core/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/ui/select';
import { useAgents } from '@/core/api/hooks/use-agents';
import {
  useAssignSkill,
  useRemoveAgentSkill,
  useAgentsWithSkill,
} from '@/core/api/hooks/use-skills';
import type { Skill } from '@/core/api/hooks/use-skills';

interface SkillAgentsProps {
  skill: Skill | null;
  onClose: () => void;
}

export function SkillAgents({ skill, onClose }: SkillAgentsProps) {
  const { t } = useTranslation(['admin']);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [localProficiencies, setLocalProficiencies] = useState<Record<string, number>>({});

  const { data: allAgents = [] } = useAgents();
  const { data: serverAssignments } = useAgentsWithSkill(skill?.name);

  // Prefer server data; fall back to client-side derivation from agents list
  const agentsWithSkill = useMemo(() => {
    if (!skill) return [];
    if (serverAssignments) {
      return serverAssignments.map((assignment) => {
        const agent = allAgents.find((a) => a.id === assignment.agentId);
        return {
          agentId: assignment.agentId,
          displayName: agent?.displayName ?? assignment.agentId,
          proficiency: localProficiencies[assignment.agentId] ?? assignment.proficiency,
        };
      });
    }
    // Fallback: derive from full agents list
    return allAgents
      .filter((a) => a.skills.some((s) => s.name === skill.name))
      .map((a) => {
        const assignment = a.skills.find((s) => s.name === skill.name);
        return {
          agentId: a.id,
          displayName: a.displayName,
          proficiency: localProficiencies[a.id] ?? assignment?.proficiency ?? 5,
        };
      });
  }, [allAgents, serverAssignments, skill, localProficiencies]);

  const assignedAgentIds = useMemo(
    () => new Set(agentsWithSkill.map((a) => a.agentId)),
    [agentsWithSkill],
  );

  const unassignedAgents = useMemo(
    () => allAgents.filter((a) => !assignedAgentIds.has(a.id)),
    [allAgents, assignedAgentIds],
  );

  const assignSkill = useAssignSkill();
  const removeAgentSkill = useRemoveAgentSkill();

  const handleAssign = () => {
    if (!skill || !selectedAgentId) return;
    assignSkill.mutate({
      agentId: selectedAgentId,
      skillName: skill.name,
      proficiency: 5,
    });
    setSelectedAgentId('');
  };

  const handleRemove = (agentId: string) => {
    if (!skill) return;
    removeAgentSkill.mutate({ agentId, skillName: skill.name });
    setLocalProficiencies((prev) => {
      const next = { ...prev };
      delete next[agentId];
      return next;
    });
  };

  const handleProficiencyChange = (agentId: string, value: number) => {
    setLocalProficiencies((prev) => ({ ...prev, [agentId]: value }));
  };

  const handleSaveProficiency = (agentId: string) => {
    if (!skill) return;
    const proficiency = localProficiencies[agentId];
    if (proficiency === undefined) return;
    assignSkill.mutate({ agentId, skillName: skill.name, proficiency });
  };

  return (
    <Sheet open={!!skill} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>
              {t('admin:skills.agentsTitle', { skill: skill?.name ?? '' })}
            </SheetTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <SheetDescription>
            {t('admin:skills.agentsDescription')}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pt-2">
          {/* Add agent */}
          <div className="space-y-1.5">
            <Label>{t('admin:skills.addAgent')}</Label>
            <div className="flex gap-2">
              <Select value={selectedAgentId} onValueChange={(v) => setSelectedAgentId(v ?? '')}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={t('admin:skills.selectAgent')} />
                </SelectTrigger>
                <SelectContent>
                  {unassignedAgents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={handleAssign}
                disabled={!selectedAgentId || assignSkill.isPending}
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Assigned agents */}
          <div className="space-y-2">
            <Label>{t('admin:skills.assignedAgents')}</Label>
            {agentsWithSkill.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t('admin:skills.noAgents')}
              </p>
            ) : (
              <ul className="space-y-3">
                {agentsWithSkill.map((entry) => (
                  <li
                    key={entry.agentId}
                    className="rounded-md border border-border bg-card p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{entry.displayName}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleRemove(entry.agentId)}
                        disabled={removeAgentSkill.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{t('admin:skills.proficiency')}</span>
                        <span className="font-medium text-foreground">{entry.proficiency}/10</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={entry.proficiency}
                        onChange={(e) =>
                          handleProficiencyChange(entry.agentId, Number(e.target.value))
                        }
                        onMouseUp={() => handleSaveProficiency(entry.agentId)}
                        onTouchEnd={() => handleSaveProficiency(entry.agentId)}
                        className="w-full accent-brand"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
