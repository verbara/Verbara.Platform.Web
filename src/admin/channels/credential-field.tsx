import { useTranslation } from 'react-i18next';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { Badge } from '@/core/ui/badge';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { FieldError } from '@/core/ui/field-error';
import { useFieldA11y } from '@/core/hooks/use-field-a11y';
import { useQueues } from '@/core/api/hooks/use-queues';
import type { FieldDef } from './channel-fields';

const SELECT_CLASS =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30';

/** Whether a stored key holds a value, as Platform reports it (`isSet`). Never the value itself. */
export function CredentialStatusBadge({
  credentialKey,
  isSet,
}: Readonly<{ credentialKey: string; isSet: boolean }>) {
  const { t } = useTranslation(['admin']);
  return (
    <Badge
      variant={isSet ? 'secondary' : 'outline'}
      data-credential-status={credentialKey}
      data-credential-set={String(isSet)}
    >
      {isSet ? t('admin:channels.credential.set') : t('admin:channels.credential.notSet')}
    </Badge>
  );
}

/** Marks a stored key for removal on save (sent as `null`), or takes the mark back. */
export function CredentialRemoveButton({
  credentialKey,
  removed,
  onToggle,
}: Readonly<{ credentialKey: string; removed: boolean; onToggle: () => void }>) {
  const { t } = useTranslation(['admin']);
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      data-credential-remove={credentialKey}
      aria-pressed={removed}
      onClick={onToggle}
    >
      {removed ? t('admin:channels.credential.undoRemove') : t('admin:channels.credential.remove')}
    </Button>
  );
}

function QueueSelect({
  id,
  isSet,
  disabled,
  registration,
  inputProps,
}: Readonly<{
  id: string;
  isSet: boolean;
  disabled: boolean;
  registration: UseFormRegisterReturn;
  inputProps: Record<string, unknown>;
}>) {
  const { t } = useTranslation(['admin']);
  const { data: queues } = useQueues();
  return (
    <select
      id={id}
      className={SELECT_CLASS}
      data-channel-field={registration.name}
      disabled={disabled}
      {...inputProps}
      {...registration}
    >
      <option value="">
        {isSet
          ? t('admin:channels.credential.queueKeep')
          : t('admin:channels.credential.queueNone')}
      </option>
      {queues?.map((q) => (
        <option key={q.id} value={q.id}>
          {q.name}
        </option>
      ))}
    </select>
  );
}

interface CredentialFieldProps {
  readonly field: FieldDef;
  readonly registration: UseFormRegisterReturn;
  readonly error: { message?: string } | undefined;
  /** Platform's `isSet` for this key; `undefined` when the stored state is not known (no badge). */
  readonly isSet?: boolean;
  /** Present when the key may be removed: only an optional key that is set. */
  readonly removal?: { removed: boolean; onToggle: () => void };
}

/**
 * One credential input. The field always starts empty, because Platform never returns a value: a
 * key that is set shows a badge and a placeholder saying a blank field keeps the stored value.
 */
export function CredentialField({
  field,
  registration,
  error,
  isSet,
  removal,
}: CredentialFieldProps) {
  const { t } = useTranslation(['admin']);
  const inputId = `channel-${field.key}`;
  const required = !field.optional && isSet !== true;
  const a11y = useFieldA11y(error, inputId, { required });
  const label = field.labelKey ? t(field.labelKey) : field.label;
  const helpId = field.helpKey ? `${inputId}-help` : undefined;
  const describedBy =
    [helpId, a11y.inputProps['aria-describedby']].filter(Boolean).join(' ') || undefined;
  const removed = removal?.removed ?? false;
  const inputProps = { ...a11y.inputProps, 'aria-describedby': describedBy };
  const message = error?.message;

  return (
    <div className="space-y-1.5" data-removed={removed ? 'true' : undefined}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={inputId} required={required}>
          {label}
        </Label>
        <div className="flex items-center gap-1">
          {isSet !== undefined && <CredentialStatusBadge credentialKey={field.key} isSet={isSet} />}
          {removal && (
            <CredentialRemoveButton
              credentialKey={field.key}
              removed={removal.removed}
              onToggle={removal.onToggle}
            />
          )}
        </div>
      </div>
      {field.type === 'queue' ? (
        <QueueSelect
          id={inputId}
          isSet={isSet === true}
          disabled={removed}
          registration={registration}
          inputProps={inputProps}
        />
      ) : (
        <Input
          id={inputId}
          type={field.type}
          autoComplete={field.type === 'password' ? 'new-password' : 'off'}
          placeholder={isSet ? t('admin:channels.credential.keepPlaceholder') : undefined}
          disabled={removed}
          data-channel-field={field.key}
          {...inputProps}
          {...registration}
        />
      )}
      {removed && (
        <p className="text-xs text-destructive">{t('admin:channels.credential.willBeRemoved')}</p>
      )}
      {field.helpKey && (
        <p
          id={helpId}
          data-channel-field-help={field.key}
          className="text-xs text-muted-foreground"
        >
          {t(field.helpKey)}
        </p>
      )}
      <FieldError id={a11y.errorId} message={message ? t(message, { field: label }) : undefined} />
    </div>
  );
}
