import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, Zap, Trash2 } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { PageHeader } from '@/admin/shared/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/admin/shared/data-table';
import { SkillForm } from './skill-form';
import { SkillAgents } from './skill-agents';
import {
  useSkills,
  useCreateSkill,
  useUpdateSkill,
  useDeleteSkill,
} from '@/core/api/hooks/use-skills';
import type { Skill } from '@/core/api/hooks/use-skills';
import type { SkillFormValues } from './skill-form';

const columnHelper = createColumnHelper<Skill>();

export default function SkillsPage() {
  const { t } = useTranslation(['admin']);
  const [createOpen, setCreateOpen] = useState(false);
  const [editSkill, setEditSkill] = useState<Skill | null>(null);
  const [agentsSkill, setAgentsSkill] = useState<Skill | null>(null);

  const { data: skills = [], isLoading } = useSkills();
  const createSkill = useCreateSkill();
  const updateSkill = useUpdateSkill();
  const deleteSkill = useDeleteSkill();

  const handleCreate = (values: SkillFormValues) => {
    createSkill.mutate({
      name: values.name,
      category: values.category,
      description: values.description,
    });
  };

  const handleUpdate = (values: SkillFormValues) => {
    if (!editSkill) return;
    updateSkill.mutate({
      name: editSkill.name,
      category: values.category,
      description: values.description,
    });
    setEditSkill(null);
  };

  const handleDelete = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(t('admin:skills.deleteConfirm'))) {
      deleteSkill.mutate(name);
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('admin:skills.name'),
        cell: (info) => (
          <span className="font-medium text-foreground">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('category', {
        header: () => t('admin:skills.category'),
        cell: (info) =>
          info.getValue() ? (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {info.getValue()}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      }),
      columnHelper.accessor('description', {
        header: () => t('admin:skills.description'),
        cell: (info) =>
          info.getValue() ? (
            <span className="text-sm text-muted-foreground line-clamp-1">
              {info.getValue()}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      }),
      columnHelper.display({
        id: 'actions',
        header: () => '',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => handleDelete(row.original.name, e)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('admin:skills.title')}>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t('admin:skills.createSkill')}
          </Button>
        </PageHeader>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  const isEmpty = skills.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin:skills.title')}>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('admin:skills.createSkill')}
        </Button>
      </PageHeader>

      {isEmpty ? (
        <EmptyState
          icon={Zap}
          message={t('admin:skills.empty')}
        />
      ) : (
        <DataTable
          data={skills}
          columns={columns}
          searchPlaceholder={t('admin:skills.searchPlaceholder')}
          noResultsMessage={t('admin:skills.noResults')}
          onRowClick={(skill) => setAgentsSkill(skill)}
        />
      )}

      <SkillForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={handleCreate}
      />

      <SkillForm
        open={!!editSkill}
        onOpenChange={(open) => {
          if (!open) setEditSkill(null);
        }}
        mode="edit"
        defaultValues={editSkill ?? undefined}
        onSubmit={handleUpdate}
      />

      <SkillAgents
        skill={agentsSkill}
        onClose={() => setAgentsSkill(null)}
      />
    </div>
  );
}
