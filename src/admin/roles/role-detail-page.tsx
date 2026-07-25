import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Checkbox } from '@/core/ui/checkbox';
import { Separator } from '@/core/ui/separator';
import {
  useRole,
  useUpdateRole,
  usePermissionCategories,
  type Permission,
} from '@/core/api/hooks/use-rbac';

/** Given a permission and the full catalog, compute implied permissions (cascading). */
function getImplied(permissionId: string, allPermissions: Map<string, string[]>): string[] {
  return allPermissions.get(permissionId) ?? [];
}

/** Given a permission being unchecked, compute permissions that should also be unchecked. */
function getDependents(permissionId: string, allPermissions: Map<string, string[]>): string[] {
  const dependents: string[] = [];
  for (const [pId, implies] of allPermissions) {
    if (implies.includes(permissionId)) {
      dependents.push(pId);
    }
  }
  return dependents;
}

export default function RoleDetailPage() {
  const { t } = useTranslation(['admin']);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: role } = useRole(id);
  const { data: categories = [] } = usePermissionCategories();
  const updateRole = useUpdateRole();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);

  // Build implies map from categories
  const impliesMap = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const cat of categories) {
      for (const p of cat.permissions) {
        m.set(p.permissionId, p.implies);
      }
    }
    return m;
  }, [categories]);

  // Sync server role into editable local form on (re)load. Legitimate because
  // we need to overwrite multiple state slots and reset dirty after refetch.
  useEffect(() => {
    if (role) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setName(role.name);
      setDescription(role.description ?? '');
      setSelected(new Set(role.permissions));
      setDirty(false);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [role]);

  function togglePermission(permissionId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(permissionId);
        // Cascade: add implied permissions
        for (const implied of getImplied(permissionId, impliesMap)) {
          next.add(implied);
        }
      } else {
        next.delete(permissionId);
        // Cascade: remove permissions that depend on this one
        for (const dep of getDependents(permissionId, impliesMap)) {
          next.delete(dep);
        }
      }
      return next;
    });
    setDirty(true);
  }

  function handleSave() {
    if (!id) return;
    updateRole.mutate({
      id,
      name,
      description: description || undefined,
      permissions: Array.from(selected),
    });
    setDirty(false);
  }

  if (!role) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t('status.loading', 'Loading...')}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6" data-testid="role-detail-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/roles')}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          {t('actions.back', 'Back')}
        </Button>
        <Button
          onClick={handleSave}
          disabled={!dirty || updateRole.isPending}
          data-testid="role-save-btn"
        >
          <Save className="mr-1.5 h-4 w-4" />
          {t('actions.save', 'Save')}
        </Button>
      </div>

      {/* Role info */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="space-y-2">
          <Label>{t('admin:roles.name', 'Name')}</Label>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
            disabled={role.isDefault}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('admin:roles.description_label', 'Description')}</Label>
          <Input
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setDirty(true);
            }}
          />
        </div>
      </div>

      {/* Permissions by category */}
      <div className="rounded-lg border bg-card p-6 space-y-6">
        <h2 className="font-heading text-base font-semibold">
          {t('admin:roles.permissions', 'Permissions')}
        </h2>

        {categories.map((cat) => (
          <div key={cat.category}>
            <h4 className="mb-3 text-sm font-medium capitalize text-muted-foreground">
              {cat.category}
            </h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {cat.permissions.map((perm: Permission) => (
                // eslint-disable-next-line jsx-a11y/label-has-associated-control -- label wraps Checkbox; implicit association via nesting
                <label
                  key={perm.permissionId}
                  className="flex items-start gap-2 rounded-md p-2 hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selected.has(perm.permissionId)}
                    onCheckedChange={(checked) =>
                      togglePermission(perm.permissionId, checked === true)
                    }
                  />
                  <div>
                    <p className="text-sm font-mono">
                      {perm.resource}:{perm.action}
                    </p>
                    <p className="text-xs text-muted-foreground">{perm.description}</p>
                  </div>
                </label>
              ))}
            </div>
            <Separator className="mt-4" />
          </div>
        ))}
      </div>
    </div>
  );
}
