import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { type ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/core/ui/badge';
import { DataTable } from '@/admin/shared/data-table';
import { ScoreInline } from './score-gauge';
import { QaDetailDrawer } from './qa-detail-drawer';

interface QaCriterion {
  name: string;
  score: number;
}

export interface QaRow {
  id: string;
  date: string;
  agent: string;
  queue: string;
  score: number;
  summary: string;
  summaryFull: string;
  compliance: 'pass' | 'fail';
  violations: string[];
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  topics: string[];
  criteria: QaCriterion[];
}

// --- Mock data ---
const MOCK_QA: QaRow[] = [
  {
    id: 'qa-01', date: '2026-03-23', agent: 'Ana Garcia', queue: 'support', score: 92,
    summary: 'Excellent resolution of billing inquiry with proper identification.',
    summaryFull: 'The agent correctly identified the customer, navigated the billing system efficiently, and resolved a double-charge issue. Tone was professional throughout.',
    compliance: 'pass', violations: [], sentiment: 'Positive',
    topics: ['Billing', 'Refund'],
    criteria: [{ name: 'Greeting', score: 95 }, { name: 'Problem Resolution', score: 90 }, { name: 'Empathy', score: 88 }, { name: 'Compliance', score: 100 }, { name: 'Closing', score: 85 }],
  },
  {
    id: 'qa-02', date: '2026-03-23', agent: 'Carlos Mendez', queue: 'support', score: 78,
    summary: 'Good technical support but missed verification step.',
    summaryFull: 'Agent resolved a connectivity issue but failed to verify the customer identity before accessing account details. Technical knowledge was strong.',
    compliance: 'fail', violations: ['Missing identity verification before account access'],
    sentiment: 'Neutral', topics: ['Technical Support', 'Network'],
    criteria: [{ name: 'Greeting', score: 80 }, { name: 'Problem Resolution', score: 85 }, { name: 'Empathy', score: 75 }, { name: 'Compliance', score: 55 }, { name: 'Closing', score: 90 }],
  },
  {
    id: 'qa-03', date: '2026-03-23', agent: 'Pedro Ruiz', queue: 'sales', score: 85,
    summary: 'Strong sales interaction with clear product explanation.',
    summaryFull: 'Agent presented the product features clearly, handled objections well, and successfully closed the sale. Could improve on asking open-ended questions.',
    compliance: 'pass', violations: [], sentiment: 'Positive',
    topics: ['Sales', 'Product Info'],
    criteria: [{ name: 'Greeting', score: 90 }, { name: 'Needs Assessment', score: 80 }, { name: 'Product Knowledge', score: 90 }, { name: 'Objection Handling', score: 82 }, { name: 'Closing', score: 85 }],
  },
  {
    id: 'qa-04', date: '2026-03-22', agent: 'Maria Lopez', queue: 'billing', score: 55,
    summary: 'Below standard handling, customer escalated to supervisor.',
    summaryFull: 'Agent struggled to explain billing charges, became defensive when customer expressed frustration, and the call was escalated. Failed to offer resolution before escalation.',
    compliance: 'fail', violations: ['No de-escalation attempt', 'Failed to offer resolution options'],
    sentiment: 'Negative', topics: ['Billing', 'Escalation'],
    criteria: [{ name: 'Greeting', score: 70 }, { name: 'Problem Resolution', score: 40 }, { name: 'Empathy', score: 45 }, { name: 'Compliance', score: 60 }, { name: 'Closing', score: 55 }],
  },
  {
    id: 'qa-05', date: '2026-03-22', agent: 'Ana Garcia', queue: 'support', score: 95,
    summary: 'Outstanding call with perfect compliance and resolution.',
    summaryFull: 'Agent handled a complex multi-issue call flawlessly. Verified identity, resolved three separate issues, and proactively offered preventive advice.',
    compliance: 'pass', violations: [], sentiment: 'Positive',
    topics: ['Account Management', 'Technical Support'],
    criteria: [{ name: 'Greeting', score: 98 }, { name: 'Problem Resolution', score: 95 }, { name: 'Empathy', score: 92 }, { name: 'Compliance', score: 100 }, { name: 'Closing', score: 90 }],
  },
  {
    id: 'qa-06', date: '2026-03-22', agent: 'Carlos Mendez', queue: 'support', score: 70,
    summary: 'Adequate resolution but long hold times and rushed closing.',
    summaryFull: 'The agent resolved the issue but placed the customer on hold three times for a total of 4 minutes. The closing was abrupt without confirming satisfaction.',
    compliance: 'pass', violations: [], sentiment: 'Neutral',
    topics: ['Technical Support', 'Hold Time'],
    criteria: [{ name: 'Greeting', score: 85 }, { name: 'Problem Resolution', score: 72 }, { name: 'Empathy', score: 65 }, { name: 'Compliance', score: 80 }, { name: 'Closing', score: 50 }],
  },
  {
    id: 'qa-07', date: '2026-03-21', agent: 'Pedro Ruiz', queue: 'sales', score: 88,
    summary: 'Effective upsell with natural conversation flow.',
    summaryFull: 'Agent identified an upsell opportunity naturally during the conversation, explained benefits clearly, and secured agreement without being pushy.',
    compliance: 'pass', violations: [], sentiment: 'Positive',
    topics: ['Sales', 'Upsell'],
    criteria: [{ name: 'Greeting', score: 92 }, { name: 'Needs Assessment', score: 85 }, { name: 'Product Knowledge', score: 95 }, { name: 'Objection Handling', score: 80 }, { name: 'Closing', score: 90 }],
  },
  {
    id: 'qa-08', date: '2026-03-21', agent: 'Maria Lopez', queue: 'billing', score: 82,
    summary: 'Solid billing inquiry handling with proper documentation.',
    summaryFull: 'Agent accurately explained all charges, verified identity properly, and documented the interaction. Minor improvement needed in empathy during payment difficulty discussion.',
    compliance: 'pass', violations: [], sentiment: 'Neutral',
    topics: ['Billing', 'Payment'],
    criteria: [{ name: 'Greeting', score: 85 }, { name: 'Problem Resolution', score: 88 }, { name: 'Empathy', score: 70 }, { name: 'Compliance', score: 90 }, { name: 'Closing', score: 78 }],
  },
  {
    id: 'qa-09', date: '2026-03-21', agent: 'Ana Garcia', queue: 'support', score: 48,
    summary: 'Poor interaction — wrong information provided to customer.',
    summaryFull: 'Agent provided incorrect information about the return policy, leading to customer confusion. Failed to verify information before communicating it.',
    compliance: 'fail', violations: ['Incorrect policy information provided', 'No information verification'],
    sentiment: 'Negative', topics: ['Returns', 'Misinformation'],
    criteria: [{ name: 'Greeting', score: 75 }, { name: 'Problem Resolution', score: 30 }, { name: 'Empathy', score: 50 }, { name: 'Compliance', score: 35 }, { name: 'Closing', score: 55 }],
  },
  {
    id: 'qa-10', date: '2026-03-20', agent: 'Carlos Mendez', queue: 'support', score: 91,
    summary: 'Excellent troubleshooting with step-by-step guidance.',
    summaryFull: 'Agent walked the customer through a complex troubleshooting process with patience and clarity. Verified each step before proceeding.',
    compliance: 'pass', violations: [], sentiment: 'Positive',
    topics: ['Technical Support', 'Troubleshooting'],
    criteria: [{ name: 'Greeting', score: 90 }, { name: 'Problem Resolution', score: 95 }, { name: 'Empathy', score: 88 }, { name: 'Compliance', score: 92 }, { name: 'Closing', score: 90 }],
  },
  {
    id: 'qa-11', date: '2026-03-20', agent: 'Pedro Ruiz', queue: 'sales', score: 65,
    summary: 'Missed opportunity — customer interest not captured.',
    summaryFull: 'Agent failed to ask qualifying questions and moved to product pitch too quickly. Customer disengaged and ended the call without commitment.',
    compliance: 'pass', violations: [], sentiment: 'Neutral',
    topics: ['Sales', 'Lead Qualification'],
    criteria: [{ name: 'Greeting', score: 80 }, { name: 'Needs Assessment', score: 45 }, { name: 'Product Knowledge', score: 75 }, { name: 'Objection Handling', score: 60 }, { name: 'Closing', score: 55 }],
  },
  {
    id: 'qa-12', date: '2026-03-20', agent: 'Maria Lopez', queue: 'billing', score: 87,
    summary: 'Professional handling of payment plan request.',
    summaryFull: 'Agent explained payment plan options clearly, helped customer select the best option, and set up the plan correctly. Excellent documentation.',
    compliance: 'pass', violations: [], sentiment: 'Positive',
    topics: ['Billing', 'Payment Plan'],
    criteria: [{ name: 'Greeting', score: 88 }, { name: 'Problem Resolution', score: 92 }, { name: 'Empathy', score: 85 }, { name: 'Compliance', score: 90 }, { name: 'Closing', score: 80 }],
  },
];

export default function QaPage() {
  const { t } = useTranslation('analytics');
  const [selectedRow, setSelectedRow] = useState<QaRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const columns = useMemo<ColumnDef<QaRow, unknown>[]>(
    () => [
      {
        accessorKey: 'date',
        header: t('cdr.date'),
      },
      {
        accessorKey: 'agent',
        header: t('cdr.agent'),
      },
      {
        accessorKey: 'queue',
        header: t('cdr.queue'),
      },
      {
        accessorKey: 'score',
        header: t('qa.score'),
        cell: ({ getValue }) => <ScoreInline score={getValue() as number} />,
      },
      {
        accessorKey: 'summary',
        header: t('qa.summary'),
        cell: ({ getValue }) => (
          <span className="line-clamp-1 max-w-[300px]">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: 'compliance',
        header: t('qa.compliance'),
        cell: ({ getValue }) => {
          const val = getValue() as string;
          return (
            <Badge variant={val === 'pass' ? 'default' : 'destructive'}>
              {val === 'pass' ? 'Pass' : 'Fail'}
            </Badge>
          );
        },
      },
    ],
    [t],
  );

  const handleRowClick = useCallback((row: QaRow) => {
    setSelectedRow(row);
    setDrawerOpen(true);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
        {t('qa.title')}
      </h1>

      <DataTable<QaRow>
        data={MOCK_QA}
        columns={columns}
        searchPlaceholder={t('cdr.search_placeholder')}
        pageSize={10}
        onRowClick={handleRowClick}
      />

      <QaDetailDrawer
        row={selectedRow}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
