import { useState, useMemo, useEffect, useCallback } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  ArrowDownToLine,
  XCircle,
  Zap,
  Server,
  Radio,
  Users,
  Cpu,
  ChevronDown,
} from 'lucide-react';
import { PageHeader } from '@/admin/shared/page-header';
import { DataTable } from '@/admin/shared/data-table';
import { Button } from '@/core/ui/button';
import { Badge } from '@/core/ui/badge';
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

// ── State badge config ──

const STATE_BADGE: Record<string, { variant: 'default' | 'destructive' | 'outline' | 'secondary'; className?: string }> = {
  Healthy: { variant: 'default' },
  Degraded: { variant: 'outline', className: 'border-amber-400 text-amber-600 dark:text-amber-400' },
  Unhealthy: { variant: 'destructive' },
  Draining: { variant: 'outline', className: 'border-amber-400 text-amber-600 dark:text-amber-400' },
  Offline: { variant: 'secondary' },
  Unknown: { variant: 'secondary' },
};

const DEFAULT_BADGE = { variant: 'secondary' as const, className: undefined };

function NodeStateBadge({ state }: Readonly<{ state: string }>) {
  const cfg = STATE_BADGE[state] ?? DEFAULT_BADGE;
  return (
    <Badge variant={cfg.variant} className={cfg.className}>
      {state}
    </Badge>
  );
}

// ── Schemas ──

const createNodeSchema = z.object({
  nodeId: z.string().min(1, 'Node ID is required'),
  amiHostname: z.string().min(1, 'Hostname is required'),
  amiPort: z.coerce.number().int().min(1).max(65535),
  amiUsername: z.string().min(1, 'Username is required'),
  amiPassword: z.string().min(1, 'Password is required'),
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

function SummaryCard({ title, value, subtitle, icon: Icon, testId }: {
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

function AddNodeSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const createNode = useCreateNode();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateNodeForm>({
    resolver: zodResolver(createNodeSchema) as any,
    defaultValues: { nodeId: '', amiHostname: '', amiPort: 5038, amiUsername: '', amiPassword: '', weight: 100, priorityTier: 1, maxCapacity: 100 },
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
          <SheetTitle>Add Node</SheetTitle>
          <SheetDescription>Register a new Asterisk node in the cluster.</SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="space-y-1.5">
            <Label htmlFor="cn-nodeId">Node ID</Label>
            <Input id="cn-nodeId" data-testid="cluster-node-id-input" placeholder="asterisk-01" {...register('nodeId')} />
            {errors.nodeId && <p className="text-xs text-destructive">{errors.nodeId.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cn-hostname">AMI Hostname</Label>
            <Input id="cn-hostname" data-testid="cluster-ami-hostname-input" placeholder="192.168.1.100" {...register('amiHostname')} />
            {errors.amiHostname && <p className="text-xs text-destructive">{errors.amiHostname.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cn-port">AMI Port</Label>
              <Input id="cn-port" type="number" data-testid="cluster-ami-port-input" {...register('amiPort')} />
              {errors.amiPort && <p className="text-xs text-destructive">{errors.amiPort.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cn-weight">Weight</Label>
              <Input id="cn-weight" type="number" data-testid="cluster-weight-input" {...register('weight')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cn-username">AMI Username</Label>
            <Input id="cn-username" data-testid="cluster-ami-username-input" {...register('amiUsername')} />
            {errors.amiUsername && <p className="text-xs text-destructive">{errors.amiUsername.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cn-password">AMI Password</Label>
            <Input id="cn-password" type="password" data-testid="cluster-ami-password-input" {...register('amiPassword')} />
            {errors.amiPassword && <p className="text-xs text-destructive">{errors.amiPassword.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cn-tier">Priority Tier</Label>
              <Input id="cn-tier" type="number" data-testid="cluster-tier-input" {...register('priorityTier')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cn-capacity">Max Capacity</Label>
              <Input id="cn-capacity" type="number" data-testid="cluster-capacity-input" {...register('maxCapacity')} />
            </div>
          </div>
          <SheetFooter className="mt-auto px-0">
            <Button type="submit" disabled={isSubmitting || createNode.isPending} data-testid="cluster-add-node-submit">
              Add Node
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ── Edit Node Sheet ──

function EditNodeSheet({ open, onOpenChange, node }: { open: boolean; onOpenChange: (v: boolean) => void; node?: ClusterNode }) {
  const updateNode = useUpdateNode();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditNodeForm>({
    resolver: zodResolver(editNodeSchema) as any,
    defaultValues: { weight: 100, priorityTier: 1, maxCapacity: 100 },
  });

  useEffect(() => {
    if (open && node) {
      reset({ weight: node.weight, priorityTier: node.priorityTier, maxCapacity: node.maxCapacity });
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
          <SheetTitle>Edit Node</SheetTitle>
          <SheetDescription>Update configuration for {node?.nodeId ?? 'node'}.</SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="space-y-1.5">
            <Label htmlFor="en-weight">Weight</Label>
            <Input id="en-weight" type="number" data-testid="cluster-edit-weight" {...register('weight')} />
            {errors.weight && <p className="text-xs text-destructive">{errors.weight.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="en-tier">Priority Tier</Label>
            <Input id="en-tier" type="number" data-testid="cluster-edit-tier" {...register('priorityTier')} />
            {errors.priorityTier && <p className="text-xs text-destructive">{errors.priorityTier.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="en-capacity">Max Capacity</Label>
            <Input id="en-capacity" type="number" data-testid="cluster-edit-capacity" {...register('maxCapacity')} />
            {errors.maxCapacity && <p className="text-xs text-destructive">{errors.maxCapacity.message}</p>}
          </div>
          <SheetFooter className="mt-auto px-0">
            <Button type="submit" disabled={isSubmitting || updateNode.isPending} data-testid="cluster-edit-node-submit">
              Save
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ── Drain Dialog ──

function DrainDialog({ open, onOpenChange, nodeId }: { open: boolean; onOpenChange: (v: boolean) => void; nodeId: string }) {
  const drainNode = useDrainNode();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DrainForm>({
    resolver: zodResolver(drainSchema) as any,
    defaultValues: { gracePeriodSeconds: 300 },
  });

  useEffect(() => {
    if (open) reset({ gracePeriodSeconds: 300 });
  }, [open, reset]);

  const onSubmit = handleSubmit((values) => {
    drainNode.mutate({ nodeId, gracePeriodSeconds: values.gracePeriodSeconds }, {
      onSuccess: () => onOpenChange(false),
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Drain Node</DialogTitle>
          <DialogDescription>
            Start draining node <strong>{nodeId}</strong>. Active calls will be allowed to finish within the grace period.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="drain-grace">Grace period (seconds)</Label>
            <Input id="drain-grace" type="number" data-testid="cluster-drain-grace-input" {...register('gracePeriodSeconds')} />
            {errors.gracePeriodSeconds && <p className="text-xs text-destructive">{errors.gracePeriodSeconds.message}</p>}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={drainNode.isPending} data-testid="cluster-drain-submit">
              Start Drain
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Collapsible Section ──

function CollapsibleSection({ title, defaultOpen, children, testId, className }: {
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

  const healthyCount = nodes.filter((n) => n.state === 'Healthy').length;
  const totalCapacity = nodes.reduce((acc, n) => acc + n.maxCapacity, 0);
  const activeDrains = status?.activeDrains ?? [];

  const handleCancelDrain = useCallback((nodeId: string) => {
    cancelDrain.mutate(nodeId);
  }, [cancelDrain]);

  const columns = useMemo(
    () => [
      col.accessor('nodeId', {
        header: () => 'Node ID',
        cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
      }),
      col.accessor('state', {
        header: () => 'State',
        cell: (info) => <NodeStateBadge state={info.getValue()} />,
      }),
      col.accessor('maxCapacity', {
        header: () => 'Max Capacity',
        cell: (info) => info.getValue(),
      }),
      col.accessor('weight', {
        header: () => 'Weight',
        cell: (info) => info.getValue(),
      }),
      col.accessor('priorityTier', {
        header: () => 'Tier',
        cell: (info) => info.getValue(),
      }),
      col.accessor('asteriskVersion', {
        header: () => 'Asterisk',
        cell: (info) => <span className="font-mono text-xs">{info.getValue() ?? 'N/A'}</span>,
      }),
      col.display({
        id: 'actions',
        cell: ({ row }) => {
          const node = row.original;
          const state = node.state;
          const canEdit = state === 'Healthy' || state === 'Degraded' || state === 'Offline' || state === 'Unhealthy';
          const canDrain = state === 'Healthy' || state === 'Degraded';
          const canCancelDrain = state === 'Draining';
          const canRemove = state === 'Offline' || state === 'Unhealthy';

          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                data-testid={`cluster-node-${node.nodeId}-actions`}
                render={<Button variant="ghost" size="sm" className="h-7 w-7 p-0" />}
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <DropdownMenuItem onClick={() => setEditNode(node)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Edit
                  </DropdownMenuItem>
                )}
                {canDrain && (
                  <DropdownMenuItem onClick={() => setDrainNodeId(node.nodeId)}>
                    <ArrowDownToLine className="mr-2 h-3.5 w-3.5" />
                    Drain
                  </DropdownMenuItem>
                )}
                {canCancelDrain && (
                  <>
                    <DropdownMenuItem onClick={() => handleCancelDrain(node.nodeId)}>
                      <XCircle className="mr-2 h-3.5 w-3.5" />
                      Cancel Drain
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setForceNode(node)}>
                      <Zap className="mr-2 h-3.5 w-3.5" />
                      Force Drain
                    </DropdownMenuItem>
                  </>
                )}
                {canRemove && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setRemoveNode(node)}>
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Remove
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      }),
    ],
    [handleCancelDrain],
  );

  return (
    <div className="space-y-6" data-testid="cluster-page">
      <PageHeader title="Cluster Management" description="Manage Asterisk nodes, drains, and platform instances.">
        <Button onClick={() => setAddOpen(true)} data-testid="cluster-add-node-btn">
          <Plus className="mr-1.5 h-4 w-4" />
          Add Node
        </Button>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard
          title="Nodes"
          value={nodes.length}
          subtitle={`${healthyCount} healthy`}
          icon={Server}
          testId="cluster-summary-nodes"
        />
        <SummaryCard
          title="Capacity"
          value={status?.totalChannels ?? 0}
          subtitle={`of ${totalCapacity} max`}
          icon={Radio}
          testId="cluster-summary-capacity"
        />
        <SummaryCard
          title="Agents"
          value={status?.totalAgents ?? 0}
          icon={Users}
          testId="cluster-summary-agents"
        />
        <SummaryCard
          title="Instances"
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
          searchPlaceholder="Search nodes..."
          noResultsMessage="No cluster nodes registered."
        />
      </div>

      {/* Active Drains */}
      {activeDrains.length > 0 && (
        <CollapsibleSection
          title={`Active Drains (${activeDrains.length})`}
          testId="cluster-active-drains"
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20"
        >
          <div className="space-y-3">
            {activeDrains.map((drain) => (
              <div key={drain.nodeId} className="flex items-center justify-between rounded-md border bg-card p-3">
                <div className="space-y-0.5">
                  <p className="font-mono text-sm font-medium">{drain.nodeId}</p>
                  <p className="text-xs text-muted-foreground">
                    {drain.remainingCallCount} calls remaining
                    {' / '}
                    {drain.naturallyCompleted} completed
                    {drain.forceDisconnected > 0 && `, ${drain.forceDisconnected} force-disconnected`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-amber-400 text-amber-600 dark:text-amber-400">{drain.state}</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7"
                    onClick={() => handleCancelDrain(drain.nodeId)}
                    disabled={cancelDrain.isPending}
                  >
                    <XCircle className="mr-1 h-3.5 w-3.5" />
                    Cancel
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
                    Force
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Platform Instances */}
      {instances.length > 0 && (
        <CollapsibleSection
          title={`Platform Instances (${instances.length})`}
          testId="cluster-instances"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {instances.map((inst) => (
              <div key={inst.instanceId} className="rounded-lg border bg-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-sm font-medium">{inst.instanceId}</p>
                  <span className="text-xs text-muted-foreground">
                    Last seen: {new Date(inst.lastSeen).toLocaleString()}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>Channels: <span className="font-medium text-foreground">{inst.activeChannels}</span></span>
                  <span>Owned nodes: <span className="font-medium text-foreground">{inst.ownedNodes.length}</span></span>
                </div>
                {inst.ownedNodes.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {inst.ownedNodes.map((n) => (
                      <Badge key={n} variant="secondary" className="text-xs">{n}</Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Sheets & Dialogs */}
      <AddNodeSheet open={addOpen} onOpenChange={setAddOpen} />

      <EditNodeSheet
        open={!!editNode}
        onOpenChange={(open) => { if (!open) setEditNode(undefined); }}
        node={editNode}
      />

      <DrainDialog
        open={!!drainNodeId}
        onOpenChange={(open) => { if (!open) setDrainNodeId(undefined); }}
        nodeId={drainNodeId ?? ''}
      />

      <ConfirmDeleteDialog
        open={!!removeNode}
        onOpenChange={(open) => { if (!open) setRemoveNode(undefined); }}
        onConfirm={() => {
          if (removeNode) deleteNode.mutate(removeNode.nodeId);
          setRemoveNode(undefined);
        }}
        entityName={removeNode?.nodeId ?? ''}
        entityType="node"
        isPending={deleteNode.isPending}
      />

      <ConfirmDeleteDialog
        open={!!forceNode}
        onOpenChange={(open) => { if (!open) setForceNode(undefined); }}
        onConfirm={() => {
          if (forceNode) forceDrain.mutate(forceNode.nodeId);
          setForceNode(undefined);
        }}
        entityName={forceNode?.nodeId ?? ''}
        entityType="force drain on node"
        isPending={forceDrain.isPending}
      />
    </div>
  );
}
