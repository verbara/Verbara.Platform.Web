import { useState, useMemo } from 'react';
import type { FormEvent } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus, Briefcase, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/core/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import { PageSkeleton } from '@/core/ui/page-skeleton';
import { PageHeader } from '@/core/ui/page-header';
import { EmptyState } from '@/admin/shared/empty-state';
import { DataTable } from '@/core/ui/data-table';
import {
  useCases,
  useCreateCase,
  useUpdateCase,
  type Case,
  type CasePriority,
  type CaseStatus,
  type CreateCaseRequest,
  type UpdateCaseRequest,
} from '@/core/api/hooks/use-cases';
import { useSearchContacts, type Contact } from '@/core/api/hooks/use-contacts';
import { useAgents } from '@/core/api/hooks/use-agents';
import { useFormatDate } from '@/core/i18n/use-format';

const PRIORITIES: CasePriority[] = ['Low', 'Normal', 'High', 'Urgent'];
const STATUSES: CaseStatus[] = ['Open', 'Pending', 'Resolved', 'Closed'];

const priorityColors: Record<CasePriority, string> = {
  Low: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  Normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  High: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const statusColors: Record<CaseStatus, string> = {
  Open: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Resolved: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Closed: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
};

const columnHelper = createColumnHelper<Case>();

function contactDisplayName(c: Contact, fallback: string): string {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  return name || fallback;
}

export default function CasesPage() {
  const { t } = useTranslation('admin');
  const { formatDateShort } = useFormatDate();
  const unnamedContact = t('cases.unnamed_contact');
  const { data, isLoading } = useCases();
  const cases = data?.items ?? [];
  const { data: agents = [] } = useAgents();
  const createMutation = useCreateCase();
  const updateMutation = useUpdateCase();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Case | null>(null);

  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState<CasePriority>('Normal');
  const [status, setStatus] = useState<CaseStatus>('Open');
  const [assignedAgentId, setAssignedAgentId] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const { data: contacts = [] } = useSearchContacts(contactSearch);

  const openCreate = () => {
    setEditing(null);
    setSubject('');
    setPriority('Normal');
    setStatus('Open');
    setAssignedAgentId('');
    setSelectedContact(null);
    setContactSearch('');
    setFormOpen(true);
  };

  const openEdit = (c: Case) => {
    setEditing(c);
    setSubject(c.subject);
    setPriority(c.priority);
    setStatus(c.status);
    setAssignedAgentId(c.assignedAgentId ?? '');
    setFormOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (editing) {
      const payload: UpdateCaseRequest & { id: string } = {
        id: editing.caseId,
        subject,
        status,
        priority,
        assignedAgentId: assignedAgentId || undefined,
      };
      updateMutation.mutate(payload, {
        onSuccess: () => setFormOpen(false),
      });
    } else {
      if (!selectedContact) return;
      const payload: CreateCaseRequest = {
        subject,
        priority,
        contactId: selectedContact.id,
        assignedAgentId: assignedAgentId || undefined,
      };
      createMutation.mutate(payload, {
        onSuccess: () => setFormOpen(false),
      });
    }
  };

  // keep manual memoization: column array is consumed by TanStack Table which
  // rebuilds internal state on identity changes — a stable reference matters
  // even when the React Compiler memoizes the producer scope. The Compiler
  // wants to add `openEdit` (recreated each render), which would defeat the
  // purpose of memoizing the columns.
  const columns = useMemo(
    () => [
      columnHelper.accessor('caseNumber', {
        header: () => t('cases.columns.case_number'),
        cell: (info) => <code className="text-xs font-medium">{info.getValue()}</code>,
      }),
      columnHelper.accessor('subject', {
        header: () => t('cases.columns.subject'),
        cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor('priority', {
        header: () => t('cases.columns.priority'),
        cell: (info) => (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${priorityColors[info.getValue()]}`}
          >
            {t(`cases.priority.${info.getValue()}`)}
          </span>
        ),
      }),
      columnHelper.accessor('status', {
        header: () => t('cases.columns.status'),
        cell: (info) => (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[info.getValue()]}`}
          >
            {t(`cases.status.${info.getValue()}`)}
          </span>
        ),
      }),
      columnHelper.accessor('conversationIds', {
        header: () => t('cases.columns.conversations'),
        cell: (info) => <Badge variant="secondary">{info.getValue().length}</Badge>,
      }),
      columnHelper.accessor('createdAt', {
        header: () => t('cases.columns.created'),
        cell: (info) => formatDateShort(info.getValue()),
      }),
      columnHelper.display({
        id: 'actions',
        header: () => '',
        cell: (info) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            data-testid={`edit-case-${info.row.original.caseId}`}
            onClick={(e) => {
              e.stopPropagation();
              openEdit(info.row.original);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ),
      }),
    ],
    [t, formatDateShort],
  );

  const isEmpty = !isLoading && cases.length === 0;

  let content;
  if (isLoading) {
    content = <PageSkeleton />;
  } else if (isEmpty) {
    content = (
      <EmptyState
        icon={Briefcase}
        message={t('cases.empty')}
        actionLabel={t('cases.create')}
        onAction={openCreate}
      />
    );
  } else {
    content = (
      <DataTable
        data={cases}
        columns={columns}
        searchPlaceholder={t('cases.search_placeholder')}
        noResultsMessage={t('cases.no_results')}
        onRowClick={openEdit}
      />
    );
  }

  return (
    <div className="space-y-6" data-testid="cases-page">
      <PageHeader title={t('cases.title')}>
        <Button data-testid="cases-create-btn" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('cases.create')}
        </Button>
      </PageHeader>

      {content}

      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {editing
                ? t('cases.form.edit_title', { number: editing.caseNumber })
                : t('cases.form.create_title')}
            </SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4 px-4 pb-4">
            <div>
              <Label htmlFor="case-subject">{t('cases.form.subject')}</Label>
              <Input
                id="case-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t('cases.form.subject_placeholder')}
                required
                data-testid="case-subject-input"
              />
            </div>

            <div>
              <Label>{t('cases.form.priority')}</Label>
              <Select
                value={priority}
                onValueChange={(v) => {
                  if (v) setPriority(v as CasePriority);
                }}
              >
                <SelectTrigger className="w-full" data-testid="case-priority-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(`cases.priority.${p}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {editing && (
              <div>
                <Label>{t('cases.form.status')}</Label>
                <Select
                  value={status}
                  onValueChange={(v) => {
                    if (v) setStatus(v as CaseStatus);
                  }}
                >
                  <SelectTrigger className="w-full" data-testid="case-status-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`cases.status.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!editing && (
              <div>
                <Label>{t('cases.form.contact')}</Label>
                {selectedContact ? (
                  <div className="flex items-center justify-between rounded-md border border-input px-3 py-2">
                    <span className="text-sm">
                      {contactDisplayName(selectedContact, unnamedContact)}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedContact(null)}
                      data-testid="case-change-contact-btn"
                    >
                      {t('cases.form.change_contact')}
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Input
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      placeholder={t('cases.form.contact_search_placeholder')}
                      data-testid="case-contact-search"
                    />
                    {contacts.length > 0 && (
                      <ul className="mt-1 max-h-32 overflow-y-auto rounded-md border border-input bg-background">
                        {contacts.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                              onClick={() => {
                                setSelectedContact(c);
                                setContactSearch('');
                              }}
                              data-testid={`case-contact-option-${c.id}`}
                            >
                              {contactDisplayName(c, unnamedContact)}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <Label>{t('cases.form.assigned_agent')}</Label>
              <Select
                value={assignedAgentId || 'unassigned'}
                onValueChange={(v) => {
                  if (v === 'unassigned') setAssignedAgentId('');
                  else if (v) setAssignedAgentId(v);
                }}
              >
                <SelectTrigger className="w-full" data-testid="case-agent-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">{t('cases.form.unassigned')}</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={
                createMutation.isPending ||
                updateMutation.isPending ||
                (!editing && !selectedContact)
              }
              data-testid="case-submit-btn"
            >
              {editing ? t('cases.form.update') : t('cases.form.create')}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
