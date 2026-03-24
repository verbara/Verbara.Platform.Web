import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

export interface Skill {
  name: string;
  category: string;
  description: string;
}

export interface AgentSkillAssignment {
  agentId: string;
  skillName: string;
  proficiency: number;
}

export function useSkills() {
  return useQuery({
    queryKey: ['skills'],
    queryFn: () =>
      customFetch<Skill[]>({ url: '/api/admin/skills', method: 'GET' }),
  });
}

export function useCreateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Skill) =>
      customFetch<Skill>({ url: '/api/admin/skills', method: 'POST', data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['skills'] });
      toast.success('Skill created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, ...data }: Skill) =>
      customFetch<Skill>({
        url: `/api/admin/skills/${name}`,
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['skills'] });
      toast.success('Skill updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      customFetch<void>({ url: `/api/admin/skills/${name}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['skills'] });
      toast.success('Skill deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAgentSkills(agentId: string | undefined) {
  return useQuery({
    queryKey: ['agent-skills', agentId],
    queryFn: () =>
      customFetch<AgentSkillAssignment[]>({
        url: `/api/admin/agents/${agentId}/skills`,
        method: 'GET',
      }),
    enabled: !!agentId,
  });
}

export function useAssignSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      agentId,
      skillName,
      proficiency,
    }: AgentSkillAssignment) =>
      customFetch<void>({
        url: `/api/admin/agents/${agentId}/skills`,
        method: 'POST',
        data: { skillName, proficiency },
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['agent-skills', variables.agentId] });
      qc.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Skill assigned');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveAgentSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      agentId,
      skillName,
    }: {
      agentId: string;
      skillName: string;
    }) =>
      customFetch<void>({
        url: `/api/admin/agents/${agentId}/skills/${skillName}`,
        method: 'DELETE',
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['agent-skills', variables.agentId] });
      qc.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Skill removed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
