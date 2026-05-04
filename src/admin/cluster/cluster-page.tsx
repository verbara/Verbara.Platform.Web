import { useState, useMemo, useEffect, useCallback } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Ellipsis,
  Pencil,
  Trash2,
  ArrowDownToLine,
  CircleX,
  Zap,
  Server,
  Radio,
  Users,
  Cpu,
  ChevronDown,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/admin/shared/page-header';
import { DataTable } from '@/admin/shared/data-table';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
import { StatusBadge } from '@/core/ui/status-badge';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/core/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/core/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/core/ui/dropdown-menu';
import {
  useClusterStatus,
  useClusterNodes,
  useClusterInstances,
  useCreateNode,
  useUpdateNode,
  useDeleteNode,
  useDrainNode,
  useCancelDrain,
  useForceDrain,
  type ClusterNode,
  type CreateNodeInput,
  type UpdateNodeInput,
} from '@/core/api/hooks/use-cluster';
import { NodeDetailDrawer } from '@/admin/cluster/node-detail-drawer';
import { useFormatDate } from '@/core/i18n/use-format';

// ── State badge ──
// Delegates to the shared StatusBadge primitive (variant="cluster-node")
// so color + label mapping lives in a single canonical place.

function NodeStateBadge({ state }: Readonly<{ state: string }>) {
  return <StatusBadge variant="cluster-node" status={state} />;
}

// ── Schemas ──

const createNodeSchema = z.object({
  nodeId: z.string().min(1, 'admin:cluster.validation.nodeIdRequired'),
  amiHostname: z.string().min(1, 'admin:cluster.validation.hostnameRequired'),
  amiPort: z.coerce.number().int().min(1).max(65535),
  amiUsername: z.string().min(1, 'admin:cluster.validation.usernameRequired'),
  amiPassword: z.string().min(1, 'admin:cluster.validation.passwordRequired'),
  weight: z.coerce.number().int().min(0).optional(),
  priorityTier: z.coerce.number().int().min(0).optional(),
  maxCapacity: z.coerce.number().int().min(0).optional(),
});

const editNodeSchema = z.object({
  weight: z.coerce.number().int().min(0),
  priorityTier: z.coerce.number().int().min(0),
  maxCapacity: z.coerce.number().int().min(0),
});

const drainSchema = z.object({
  gracePeriodSeconds: z.coerce.number().int().min(0),
});

type CreateNodeForm = z.infer<typeof createNodeSchema>;
type EditNodeForm = z.infer<typeof editNodeSchema>;
type DrainForm = z.infer<typeof drainSchema>;

// ── Summary Card ──

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  testId,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: typeof Server;
  testId: string;
}) {
  return (
    <div data-testid={testId} className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wider">{title}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

// ── Add Node Sheet ──

function AddNodeSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useTranslation('admin');
  const createNode = useCreateNode();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateNodeForm>({
    resolver: zodResolver(createNodeSchema) as Resolver<CreateNodeForm>,
    defaultValues: {
      nodeId: '',
      amiHostname: '',
      amiPort: 5038,
      amiUsername: '',
      amiPassword: '',
      weight: 100,
      priorityTier: 1,
      maxCapacity: 100,
    },
  });

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const onSubmit = handleSubmit((values) => {
    const input: CreateNodeInput = {
      nodeId: values.nodeId,
      amiHostname: values.amiHostname,
      amiPort: values.amiPort,
      amiUsername: values.amiUsername,
      amiPassword: values.amiPassword,
      weight: values.weight,
      priorityTier: values.priorityTier,
      maxCapacity: values.maxCapacity,
    };
    createNode.mutate(input, { onSuccess: () => onOpenChange(false) });
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg" data-testid="cluster-add-node-sheet">
        <SheetHeader>
          <SheetTitle>{t('cluster.add_sheet.title')}</SheetTitle>
          <SheetDescription>{t('cluster.add_sheet.description')}</SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="space-y-1.5">
            <Label htmlFor="cn-nodeId">{t('cluster.add_sheet.node_id')}</Label>
            <Input
              id="cn-nodeId"
              data-testid="cluster-node-id-input"
              placeholder={t('cluster.add_sheet.node_id_placeholder')}
              {...register('nodeId')}
            />
            {errors.nodeId && (
              <p className="text-xs text-destructive">{t(errors.nodeId.message ?? '')}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cn-hostname">{t('cluster.add_sheet.ami_hostname')}</Label>
            <Input
              id="cn-hostname"
              data-testid="cluster-ami-hostname-input"
              placeholder={t('cluster.add_sheet.ami_hostname_placeholder')}
              {...register('amiHostname')}
            />
            {errors.amiHostname && (
              <p className="text-xs text-destructive">{t(errors.amiHostname.message ?? '')}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cn-port">{t('cluster.add_sheet.ami_port')}</Label>
              <Input
                id="cn-port"
                type="number"
                data-testid="cluster-ami-port-input"
                {...register('amiPort')}
              />
              {errors.amiPort && (
                <p className="text-xs text-destructive">{errors.amiPort.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cn-weight">{t('cluster.add_sheet.weight')}</Label>
              <Input
                id="cn-weight"
                type="number"
                data-testid="cluster-weight-input"
                {...register('weight')}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cn-username">{t('cluster.add_sheet.ami_username')}</Label>
            <Input
              id="cn-username"
              data-testid="cluster-ami-username-input"
              {...register('amiUsername')}
            />
            {errors.amiUsername && (
              <p className="text-xs text-destructive">{t(errors.amiUsername.message ?? '')}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cn-password">{t('cluster.add_sheet.ami_password')}</Label>
            <Input
              id="cn-password"
              type="password"
              data-testid="cluster-ami-password-input"
              {...register('amiPassword')}
            />
            {errors.amiPassword && (
              <p className="text-xs text-destructive">{t(errors.amiPassword.message ?? '')}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cn-tier">{t('cluster.add_sheet.priority_tier')}</Label>
              <Input
                id="cn-tier"
                type="number"
                data-testid="cluster-tier-input"
                {...register('priorityTier')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cn-capacity">{t('cluster.add_sheet.max_capacity')}</Label>
              <Input
                id="cn-capacity"
                type="number"
                data-testid="cluster-capacity-input"
                {...register('maxCapacity')}
              />
            </div>
          </div>
          <SheetFooter className="mt-auto px-0">
            <Button
              type="submit"
              disabled={isSubmitting || createNode.isPending}
              data-testid="cluster-add-node-submit"
            >
              {t('cluster.add_sheet.submit')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ── Edit Node Sheet ──

function EditNodeSheet({
  open,
  onOpenChange,
  node,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  node?: ClusterNode;
}) {
  const { t } = useTranslation('admin');
  const updateNode = useUpdateNode();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditNodeForm>({
    resolver: zodResolver(editNodeSchema) as Resolver<EditNodeForm>,
    defaultValues: { weight: 100, priorityTier: 1, maxCapacity: 100 },
  });

  useEffect(() => {
    if (open && node) {
      reset({
        weight: node.weight,
        priorityTier: node.priorityTier,
        maxCapacity: node.maxCapacity,
      });
    }
  }, [open, node, reset]);

  const onSubmit = handleSubmit((values) => {
    if (!node) return;
    const input: UpdateNodeInput & { nodeId: string } = {
      nodeId: node.nodeId,
      weight: values.weight,
      priorityTier: values.priorityTier,
      maxCapacity: values.maxCapacity,
    };
    updateNode.mutate(input, { onSuccess: () => onOpenChange(false) });
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md" data-testid="cluster-edit-node-sheet">
        <SheetHeader>
          <SheetTitle>{t('cluster.edit_sheet.title')}</SheetTitle>
          <SheetDescription>
            {t('cluster.edit_sheet.description', { nodeId: node?.nodeId ?? 'node' })}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="space-y-1.5">
            <Label htmlFor="en-weight">{t('cluster.edit_sheet.weight')}</Label>
            <Input
              id="en-weight"
              type="number"
              data-testid="cluster-edit-weight"
              {...register('weight')}
            />
            {errors.weight && <p className="text-xs text-destructive">{errors.weight.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="en-tier">{t('cluster.edit_sheet.priority_tier')}</Label>
            <Input
              id="en-tier"
              type="number"
              data-testid="cluster-edit-tier"
              {...register('priorityTier')}
            />
            {errors.priorityTier && (
              <p className="text-xs text-destructive">{errors.priorityTier.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="en-capacity">{t('cluster.edit_sheet.max_capacity')}</Label>
            <Input
              id="en-capacity"
              type="number"
              data-testid="cluster-edit-capacity"
              {...register('maxCapacity')}
            />
            {errors.maxCapacity && (
              <p className="text-xs text-destructive">{errors.maxCapacity.message}</p>
            )}
          </div>
          <SheetFooter className="mt-auto px-0">
            <Button
              type="submit"
              disabled={isSubmitting || updateNode.isPending}
              data-testid="cluster-edit-node-submit"
            >
              {t('cluster.edit_sheet.submit')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ── Drain Dialog ──

function DrainDialog({
  open,
  onOpenChange,
  nodeId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nodeId: string;
}) {
  const { t } = useTranslation('admin');
  const drainNode = useDrainNode();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DrainForm>({
    resolver: zodResolver(drainSchema) as Resolver<DrainForm>,
    defaultValues: { gracePeriodSeconds: 300 },
  });

  useEffect(() => {
    if (open) reset({ gracePeriodSeconds: 300 });
  }, [open, reset]);

  const onSubmit = handleSubmit((values) => {
    drainNode.mutate(
      { nodeId, gracePeriodSeconds: values.gracePeriodSeconds },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('cluster.drain_dialog.title')}</DialogTitle>
          <DialogDescription>
            {t('cluster.drain_dialog.description_prefix')}
            <strong>{nodeId}</strong>
            {t('cluster.drain_dialog.description_suffix')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="drain-grace">{t('cluster.drain_dialog.grace_period')}</Label>
            <Input
              id="drain-grace"
              type="number"
              data-testid="cluster-drain-grace-input"
              {...register('gracePeriodSeconds')}
            />
            {errors.gracePeriodSeconds && (
              <p className="text-xs text-destructive">{errors.gracePeriodSeconds.message}</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t('cluster.drain_dialog.cancel')}
            </DialogClose>
            <Button type="submit" disabled={drainNode.isPending} data-testid="cluster-drain-submit">
              {t('cluster.drain_dialog.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Collapsible Section ──

function CollapsibleSection({
  title,
  defaultOpen,
  children,
  testId,
  className,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  testId?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  return (
    <div data-testid={testId} className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />
        {title}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

// ── Main Page ──

const col = createColumnHelper<ClusterNode>();

export default function ClusterPage() {
  const { t } = useTranslation('admin');
  const { formatDateTime } = useFormatDate();
  const { data: status } = useClusterStatus();
  const { data: nodes = [] } = useClusterNodes();
  const { data: instances = [] } = useClusterInstances();
  const deleteNode = useDeleteNode();
  const cancelDrain = useCancelDrain();
  const forceDrain = useForceDrain();

  const [addOpen, setAddOpen] = useState(false);
  const [editNode, setEditNode] = useState<ClusterNode | undefined>();
  const [drainNodeId, setDrainNodeId] = useState<string | undefined>();
  const [removeNode, setRemoveNode] = useState<ClusterNode | undefined>();
  const [forceNode, setForceNode] = useState<ClusterNode | undefined>();
  const [detailNode, setDetailNode] = useState<ClusterNode | undefined>();

  const healthyCount = nodes.filter((n) => n.state === 'Healthy').length;
  const totalCapacity = nodes.reduce((acc, n) => acc + n.maxCapacity, 0);
  const activeDrains = status?.activeDrains ?? [];

  const handleCancelDrain = useCallback(
    (nodeId: string) => {
      cancelDrain.mutate(nodeId);
    },
    [cancelDrain],
  );

  const columns = useMemo(
    () => [
      col.accessor('nodeId', {
        header: () => t('cluster.columns.node_id'),
        cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
      }),
      col.accessor('state', {
        header: () => t('cluster.columns.state'),
        cell: (info) => <NodeStateBadge state={info.getValue()} />,
      }),
      col.accessor('maxCapacity', {
        header: () => t('cluster.columns.max_capacity'),
        cell: (info) => info.getValue(),
      }),
      col.accessor('weight', {
        header: () => t('cluster.columns.weight'),
        cell: (info) => info.getValue(),
      }),
      col.accessor('priorityTier', {
        header: () => t('cluster.columns.tier'),
        cell: (info) => info.getValue(),
      }),
      col.accessor('asteriskVersion', {
        header: () => t('cluster.columns.asterisk'),
        cell: (info) => (
          <span className="font-mono text-xs">{info.getValue() ?? t('cluster.columns.na')}</span>
        ),
      }),
      col.display({
        id: 'actions',
        cell: ({ row }) => {
          const node = row.original;
          const state = node.state;
          const canEdit =
            state === 'Healthy' ||
            state === 'Degraded' ||
            state === 'Offline' ||
            state === 'Unhealthy';
          const canDrain = state === 'Healthy' || state === 'Degraded';
          const canCancelDrain = state === 'Draining';
          const canRemove = state === 'Offline' || state === 'Unhealthy';

          // Stop propagation on the actions cell so clicking the kebab menu
          // (or any item inside it) does not bubble up to the row-click
          // handler that opens the detail drawer. `onClickCapture` at the
          // wrapper is a native <span>, not an interactive element — we're
          // only intercepting bubbling, so no keyboard handler is required.
          const stop = (e: React.MouseEvent) => e.stopPropagation();
          return (
            <span className="inline-block" onClickCapture={stop}>
              <DropdownMenu>
                <DropdownMenuTrigger
                  data-testid={`cluster-node-${node.nodeId}-actions`}
                  render={<Button variant="ghost" size="sm" className="h-7 w-7 p-0" />}
                >
                  <Ellipsis className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canEdit && (
                    <DropdownMenuItem onClick={() => setEditNode(node)}>
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      {t('cluster.actions.edit')}
                    </DropdownMenuItem>
                  )}
                  {canDrain && (
                    <DropdownMenuItem onClick={() => setDrainNodeId(node.nodeId)}>
                      <ArrowDownToLine className="mr-2 h-3.5 w-3.5" />
                      {t('cluster.actions.drain')}
                    </DropdownMenuItem>
                  )}
                  {canCancelDrain && (
                    <>
                      <DropdownMenuItem onClick={() => handleCancelDrain(node.nodeId)}>
                        <CircleX className="mr-2 h-3.5 w-3.5" />
                        {t('cluster.actions.cancel_drain')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setForceNode(node)}>
                        <Zap className="mr-2 h-3.5 w-3.5" />
                        {t('cluster.actions.force_drain')}
                      </DropdownMenuItem>
                    </>
                  )}
                  {canRemove && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => setRemoveNode(node)}>
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        {t('cluster.actions.remove')}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
          );
        },
      }),
    ],
    // setEditNode/setDrainNodeId/setForceNode/setRemoveNode are stable useState
    // setters; including them satisfies the Compiler's inferred-dependency check.
    [handleCancelDrain, t, setEditNode, setDrainNodeId, setForceNode, setRemoveNode],
  );

  return (
    <div className="space-y-6" data-testid="cluster-page">
      <PageHeader title={t('cluster.title')} description={t('cluster.description')}>
        <Button onClick={() => setAddOpen(true)} data-testid="cluster-add-node-btn">
          <Plus className="mr-1.5 h-4 w-4" />
          {t('cluster.add_node')}
        </Button>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard
          title={t('cluster.summary.nodes')}
          value={nodes.length}
          subtitle={t('cluster.summary.healthy', { count: healthyCount })}
          icon={Server}
          testId="cluster-summary-nodes"
        />
        <SummaryCard
          title={t('cluster.summary.capacity')}
          value={status?.totalChannels ?? 0}
          subtitle={t('cluster.summary.of_max', { total: totalCapacity })}
          icon={Radio}
          testId="cluster-summary-capacity"
        />
        <SummaryCard
          title={t('cluster.summary.agents')}
          value={status?.totalAgents ?? 0}
          icon={Users}
          testId="cluster-summary-agents"
        />
        <SummaryCard
          title={t('cluster.summary.instances')}
          value={instances.length}
          icon={Cpu}
          testId="cluster-summary-instances"
        />
      </div>

      {/* Nodes Table */}
      <div data-testid="cluster-nodes-table">
        <DataTable
          data={nodes}
          columns={columns}
          searchPlaceholder={t('cluster.search_placeholder')}
          noResultsMessage={t('cluster.no_results')}
          onRowClick={(row) => setDetailNode(row)}
        />
      </div>

      {/* Active Drains */}
      {activeDrains.length > 0 && (
        <CollapsibleSection
          title={t('cluster.drains.title', { count: activeDrains.length })}
          testId="cluster-active-drains"
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20"
        >
          <div className="space-y-3">
            {activeDrains.map((drain) => (
              <div
                key={drain.nodeId}
                className="flex items-center justify-between rounded-md border bg-card p-3"
              >
                <div className="space-y-0.5">
                  <p className="font-mono text-sm font-medium">{drain.nodeId}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('cluster.drains.remaining', { count: drain.remainingCallCount })}
                    {' / '}
                    {t('cluster.drains.completed', { count: drain.naturallyCompleted })}
                    {drain.forceDisconnected > 0 &&
                      `, ${t('cluster.drains.force_disconnected', { count: drain.forceDisconnected })}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge variant="cluster-node" status={drain.state} />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7"
                    onClick={() => handleCancelDrain(drain.nodeId)}
                    disabled={cancelDrain.isPending}
                  >
                    <CircleX className="mr-1 h-3.5 w-3.5" />
                    {t('cluster.drains.cancel')}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-7"
                    onClick={() => {
                      const drainNode = nodes.find((n) => n.nodeId === drain.nodeId);
                      if (drainNode) setForceNode(drainNode);
                    }}
                    disabled={forceDrain.isPending}
                  >
                    <Zap className="mr-1 h-3.5 w-3.5" />
                    {t('cluster.drains.force')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Platform Instances — always rendered (with empty state) so platform
          admins always have a visual for their instance registry. The section
          was previously conditional on `instances.length > 0`, which hid it on
          fresh installs where no Platform.Api replica has registered yet. */}
      <CollapsibleSection
        title={t('cluster.instances.title', { count: instances.length })}
        testId="cluster-instances"
      >
        {instances.length === 0 ? (
          <div
            className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground"
            data-testid="cluster-instances-empty"
          >
            {t('cluster.instances.empty')}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {instances.map((inst) => (
              <div key={inst.instanceId} className="rounded-lg border bg-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-sm font-medium">{inst.instanceId}</p>
                  <span className="text-xs text-muted-foreground">
                    {t('cluster.instances.last_seen', { date: formatDateTime(inst.lastSeen) })}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>
                    {t('cluster.instances.channels')}{' '}
                    <span className="font-medium text-foreground">{inst.activeChannels}</span>
                  </span>
                  <span>
                    {t('cluster.instances.owned_nodes')}{' '}
                    <span className="font-medium text-foreground">{inst.ownedNodes.length}</span>
                  </span>
                </div>
                {inst.ownedNodes.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {inst.ownedNodes.map((n) => (
                      <Badge key={n} variant="secondary" className="text-xs">
                        {n}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Sheets & Dialogs */}
      <AddNodeSheet open={addOpen} onOpenChange={setAddOpen} />

      <EditNodeSheet
        open={!!editNode}
        onOpenChange={(open) => {
          if (!open) setEditNode(undefined);
        }}
        node={editNode}
      />

      <DrainDialog
        open={!!drainNodeId}
        onOpenChange={(open) => {
          if (!open) setDrainNodeId(undefined);
        }}
        nodeId={drainNodeId ?? ''}
      />

      <ConfirmDeleteDialog
        open={!!removeNode}
        onOpenChange={(open) => {
          if (!open) setRemoveNode(undefined);
        }}
        onConfirm={() => {
          if (removeNode) deleteNode.mutate(removeNode.nodeId);
          setRemoveNode(undefined);
        }}
        entityName={removeNode?.nodeId ?? ''}
        entityType={t('cluster.remove_entity')}
        isPending={deleteNode.isPending}
      />

      <ConfirmDeleteDialog
        open={!!forceNode}
        onOpenChange={(open) => {
          if (!open) setForceNode(undefined);
        }}
        onConfirm={() => {
          if (forceNode) forceDrain.mutate(forceNode.nodeId);
          setForceNode(undefined);
        }}
        entityName={forceNode?.nodeId ?? ''}
        entityType={t('cluster.force_drain_entity')}
        isPending={forceDrain.isPending}
        confirmationWord="FORCE"
      />

      <NodeDetailDrawer
        node={detailNode}
        activeDrain={
          detailNode ? activeDrains.find((d) => d.nodeId === detailNode.nodeId) : undefined
        }
        open={!!detailNode}
        onOpenChange={(open) => {
          if (!open) setDetailNode(undefined);
        }}
      />
    </div>
  );
}
