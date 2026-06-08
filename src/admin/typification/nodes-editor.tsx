import { useTranslation } from 'react-i18next';
import { Controller } from 'react-hook-form';
import type { Control, UseFormRegister, UseFormWatch, FieldErrors } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Switch } from '@/core/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import { LEAF_CATEGORIES } from './typification-schema';
import { NONE_VALUE } from './typification-mappers';
import type { TypificationSchemaFormValues } from './typification-schema';

interface NodesEditorProps {
  control: Control<TypificationSchemaFormValues>;
  register: UseFormRegister<TypificationSchemaFormValues>;
  watch: UseFormWatch<TypificationSchemaFormValues>;
  errors: FieldErrors<TypificationSchemaFormValues>;
  fields: { id: string }[];
  onAdd: () => void;
  onRemove: (index: number) => void;
}

export function NodesEditor({
  control,
  register,
  watch,
  errors,
  fields,
  onAdd,
  onRemove,
}: NodesEditorProps) {
  const { t } = useTranslation(['admin']);
  const nodes = watch('nodes');

  return (
    <div className="space-y-3" data-testid="nodes-editor">
      <div className="flex items-center justify-between">
        <div>
          <Label>{t('admin:typification.nodes.title')}</Label>
          <p className="text-xs text-muted-foreground">{t('admin:typification.nodes.hint')}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onAdd}
          data-testid="add-node-btn"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t('admin:typification.nodes.add')}
        </Button>
      </div>

      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('admin:typification.nodes.empty')}</p>
      )}

      {fields.map((field, index) => {
        const isLeaf = watch(`nodes.${index}.isLeaf`);
        const triggerRetry = watch(`nodes.${index}.triggerRetry`);
        const nodeId = nodes?.[index]?.nodeId;
        const nodeErrors = errors.nodes?.[index];
        return (
          <div
            key={field.id}
            className="rounded-md border bg-muted/30 p-3 space-y-3"
            data-testid={`node-row-${index}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {t('admin:typification.nodes.nodeN', { n: index + 1 })}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="ml-auto h-6 w-6 p-0 text-destructive hover:text-destructive"
                onClick={() => onRemove(index)}
                data-testid={`remove-node-${index}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{t('admin:typification.nodes.label')}</Label>
                <Input
                  placeholder={t('admin:typification.nodes.labelPlaceholder')}
                  data-testid={`node-label-${index}`}
                  {...register(`nodes.${index}.label`)}
                />
                {nodeErrors?.label && (
                  <p className="text-xs text-destructive">{t(nodeErrors.label.message ?? '')}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('admin:typification.nodes.code')}</Label>
                <Input
                  placeholder={t('admin:typification.nodes.codePlaceholder')}
                  data-testid={`node-code-${index}`}
                  {...register(`nodes.${index}.code`)}
                />
                {nodeErrors?.code && (
                  <p className="text-xs text-destructive">{t(nodeErrors.code.message ?? '')}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{t('admin:typification.nodes.parent')}</Label>
                <Controller
                  control={control}
                  name={`nodes.${index}.parentNodeId`}
                  render={({ field: f }) => (
                    <Select value={f.value} onValueChange={f.onChange}>
                      <SelectTrigger className="w-full" data-testid={`node-parent-${index}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>
                          {t('admin:typification.nodes.rootOption')}
                        </SelectItem>
                        {nodes
                          ?.filter((n) => n.nodeId !== nodeId)
                          .map((n) => (
                            <SelectItem key={n.nodeId} value={n.nodeId}>
                              {n.label || n.code || n.nodeId}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('admin:typification.nodes.sortOrder')}</Label>
                <Input
                  type="number"
                  data-testid={`node-sort-${index}`}
                  {...register(`nodes.${index}.sortOrder`, { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Controller
                  control={control}
                  name={`nodes.${index}.isLeaf`}
                  render={({ field: f }) => (
                    <Switch
                      checked={f.value}
                      onCheckedChange={f.onChange}
                      data-testid={`node-isleaf-${index}`}
                    />
                  )}
                />
                <Label className="text-xs">{t('admin:typification.nodes.isLeaf')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Controller
                  control={control}
                  name={`nodes.${index}.isActive`}
                  render={({ field: f }) => (
                    <Switch
                      checked={f.value}
                      onCheckedChange={f.onChange}
                      data-testid={`node-isactive-${index}`}
                    />
                  )}
                />
                <Label className="text-xs">{t('admin:typification.nodes.isActive')}</Label>
              </div>
            </div>

            {isLeaf && (
              <div
                className="space-y-3 rounded-md border border-dashed bg-background p-3"
                data-testid={`node-leaf-${index}`}
              >
                <p className="text-xs font-medium text-muted-foreground">
                  {t('admin:typification.nodes.leafTitle')}
                </p>
                <div className="space-y-1">
                  <Label className="text-xs">{t('admin:typification.nodes.category')}</Label>
                  <Controller
                    control={control}
                    name={`nodes.${index}.leafCategory`}
                    render={({ field: f }) => (
                      <Select value={f.value} onValueChange={f.onChange}>
                        <SelectTrigger className="w-full" data-testid={`node-category-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAF_CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {t(`admin:typification.categories.${c}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Controller
                      control={control}
                      name={`nodes.${index}.triggerRetry`}
                      render={({ field: f }) => (
                        <Switch
                          checked={f.value}
                          onCheckedChange={f.onChange}
                          data-testid={`node-retry-${index}`}
                        />
                      )}
                    />
                    <Label className="text-xs">{t('admin:typification.nodes.triggerRetry')}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Controller
                      control={control}
                      name={`nodes.${index}.triggerCallback`}
                      render={({ field: f }) => (
                        <Switch
                          checked={f.value}
                          onCheckedChange={f.onChange}
                          data-testid={`node-callback-${index}`}
                        />
                      )}
                    />
                    <Label className="text-xs">
                      {t('admin:typification.nodes.triggerCallback')}
                    </Label>
                  </div>
                </div>

                {triggerRetry && (
                  <div className="space-y-1">
                    <Label className="text-xs">{t('admin:typification.nodes.retryDelay')}</Label>
                    <Input
                      type="number"
                      min={0}
                      className="w-32"
                      data-testid={`node-retrydelay-${index}`}
                      {...register(`nodes.${index}.retryDelayMinutes`, {
                        setValueAs: (v) => (v === '' || v === null ? undefined : Number(v)),
                      })}
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs">{t('admin:typification.nodes.dialerCode')}</Label>
                  <Input
                    className="w-40"
                    placeholder={t('admin:typification.nodes.dialerCodePlaceholder')}
                    data-testid={`node-dialercode-${index}`}
                    {...register(`nodes.${index}.dialerCode`)}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
