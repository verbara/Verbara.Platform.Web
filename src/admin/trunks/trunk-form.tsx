import { useEffect, useState } from 'react';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { FieldError } from '@/core/ui/field-error';
import { useFieldA11y } from '@/core/hooks/use-field-a11y';
import { Switch } from '@/core/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/core/ui/sheet';
import {
  useCreateTrunk,
  useUpdateTrunk,
  type TrunkSummary,
  type TrunkWriteFields,
} from '@/core/api/hooks/use-trunks';
import { CodecSelector } from '@/core/voice/codec-selector';

const TRUNK_TYPES = ['SIP', 'PJSIP', 'IAX2', 'DAHDI'] as const;

const TRANSPORTS = ['transport-udp', 'transport-tcp', 'transport-ws', 'transport-wss'] as const;

// IPv4 / IPv6 host or CIDR. Permissive but rejects obvious junk so an operator
// gets early feedback before the carrier rejects the trunk.
const IPV4_CIDR =
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}(\/(3[0-2]|[12]?\d))?$/;
const IPV6_CIDR = /^([0-9a-fA-F:]+)(\/(12[0-8]|1[01]\d|\d?\d))?$/;

function isValidHostOrCidr(value: string): boolean {
  if (IPV4_CIDR.test(value)) return true;
  // IPv6 must contain a colon and be a plausible hextet/CIDR shape.
  return value.includes(':') && IPV6_CIDR.test(value);
}

const trunkSchema = z.object({
  name: z.string().min(1, 'admin:trunks.validation.nameRequired'),
  displayName: z.string().min(1, 'admin:trunks.validation.displayNameRequired'),
  type: z.enum(['SIP', 'PJSIP', 'IAX2', 'DAHDI']),
  maxChannels: z.coerce.number().int().min(1, 'admin:trunks.validation.maxChannelsAtLeastOne'),
  isActive: z.boolean(),
  matchHost: z
    .string()
    .optional()
    .refine((v) => !v || isValidHostOrCidr(v), 'admin:trunks.validation.matchHostInvalid'),
  authUsername: z.string().optional(),
  authPassword: z.string().optional(),
  registrationUri: z.string().optional(),
  clientUri: z.string().optional(),
  codecs: z.string().optional(),
  transport: z.string().optional(),
  context: z.string().optional(),
});

export type TrunkFormValues = z.infer<typeof trunkSchema>;

interface TrunkFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  trunk?: TrunkSummary;
}

const EMPTY_DEFAULTS: TrunkFormValues = {
  name: '',
  displayName: '',
  type: 'PJSIP',
  maxChannels: 10,
  isActive: true,
  matchHost: '',
  authUsername: '',
  authPassword: '',
  registrationUri: '',
  clientUri: '',
  codecs: '',
  transport: '',
  context: '',
};

export function TrunkForm({ open, onOpenChange, mode, trunk }: TrunkFormProps) {
  const { t } = useTranslation('admin');
  const createTrunk = useCreateTrunk();
  const updateTrunk = useUpdateTrunk();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // Collapse the Advanced section each time the sheet (re)opens, using the
  // React-recommended "store previous prop in state" pattern (no setState in an
  // effect, no ref reads during render — both forbidden by the lint config).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setAdvancedOpen(false);
  }

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TrunkFormValues>({
    resolver: zodResolver(trunkSchema) as Resolver<TrunkFormValues>,
    defaultValues: EMPTY_DEFAULTS,
  });

  const nameA11y = useFieldA11y(errors.name, 'trunk-name', { required: true });
  const displayNameA11y = useFieldA11y(errors.displayName, 'trunk-displayName', { required: true });
  const maxChannelsA11y = useFieldA11y(errors.maxChannels, 'trunk-maxChannels', { required: true });
  const matchHostA11y = useFieldA11y(errors.matchHost, 'trunk-matchHost');

  useEffect(() => {
    if (open) {
      // `authPassword` is write-only and never returned, so it is ALWAYS blank
      // on open — even in edit mode — and only sent if the operator types one.
      reset(
        trunk
          ? {
              name: trunk.name,
              displayName: trunk.displayName,
              type: trunk.type as TrunkFormValues['type'],
              maxChannels: trunk.maxChannels,
              isActive: trunk.isActive,
              matchHost: trunk.matchHost ?? '',
              authUsername: trunk.authUsername ?? '',
              authPassword: '',
              registrationUri: trunk.registrationUri ?? '',
              clientUri: trunk.clientUri ?? '',
              codecs: trunk.codecs ?? '',
              transport: trunk.transport ?? '',
              context: trunk.context ?? '',
            }
          : EMPTY_DEFAULTS,
      );
    }
  }, [open, trunk, reset]);

  const handleFormSubmit = handleSubmit((values) => {
    const trimmed = (v: string | undefined) => {
      const s = v?.trim();
      return s ? s : undefined;
    };

    const payload: TrunkWriteFields = {
      name: values.name,
      displayName: values.displayName,
      type: values.type,
      maxChannels: values.maxChannels,
      isActive: values.isActive,
      matchHost: trimmed(values.matchHost),
      authUsername: trimmed(values.authUsername),
      registrationUri: trimmed(values.registrationUri),
      clientUri: trimmed(values.clientUri),
      codecs: trimmed(values.codecs),
      transport: trimmed(values.transport),
      context: trimmed(values.context),
    };

    // Only send the password when the operator actually typed one — never
    // overwrite the stored secret with a blank on edit.
    const password = trimmed(values.authPassword);
    if (password) {
      payload.authPassword = password;
    }

    if (mode === 'edit' && trunk) {
      updateTrunk.mutate({ id: trunk.id, ...payload });
    } else {
      createTrunk.mutate(payload);
    }
    onOpenChange(false);
  });

  const title = mode === 'create' ? t('trunks.form.create_title') : t('trunks.form.edit_title');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === 'create'
              ? t('trunks.form.create_description')
              : t('trunks.form.edit_description')}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleFormSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="trunk-name" required>
              {t('trunks.name')}
            </Label>
            <Input
              id="trunk-name"
              placeholder={t('trunks.form.name_placeholder')}
              data-testid="trunk-form-name"
              {...nameA11y.inputProps}
              {...register('name')}
            />
            <FieldError
              id={nameA11y.errorId}
              message={errors.name?.message ? t(errors.name.message) : undefined}
            />
          </div>

          {/* Display Name */}
          <div className="space-y-1.5">
            <Label htmlFor="trunk-displayName" required>
              {t('trunks.displayName')}
            </Label>
            <Input
              id="trunk-displayName"
              placeholder={t('trunks.form.display_name_placeholder')}
              data-testid="trunk-form-displayName"
              {...displayNameA11y.inputProps}
              {...register('displayName')}
            />
            <FieldError
              id={displayNameA11y.errorId}
              message={errors.displayName?.message ? t(errors.displayName.message) : undefined}
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label>{t('trunks.type')}</Label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full" data-testid="trunk-form-type">
                    <SelectValue placeholder={t('trunks.form.select_type')} />
                  </SelectTrigger>
                  <SelectContent>
                    {TRUNK_TYPES.map((tt) => (
                      <SelectItem key={tt} value={tt}>
                        {tt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Max Channels */}
          <div className="space-y-1.5">
            <Label htmlFor="trunk-maxChannels" required>
              {t('trunks.maxChannels')}
            </Label>
            <Input
              id="trunk-maxChannels"
              type="number"
              min={1}
              placeholder="10"
              data-testid="trunk-form-maxChannels"
              {...maxChannelsA11y.inputProps}
              {...register('maxChannels')}
            />
            <FieldError
              id={maxChannelsA11y.errorId}
              message={errors.maxChannels?.message ? t(errors.maxChannels.message) : undefined}
            />
          </div>

          {/* Match Host (IP-ACL) */}
          <div className="space-y-1.5">
            <Label htmlFor="trunk-matchHost">{t('trunks.matchHost')}</Label>
            <Input
              id="trunk-matchHost"
              placeholder={t('trunks.form.match_host_placeholder')}
              data-testid="trunk-form-matchHost"
              {...matchHostA11y.inputProps}
              {...register('matchHost')}
            />
            <p className="text-xs text-muted-foreground">{t('trunks.form.match_host_hint')}</p>
            <FieldError
              id={matchHostA11y.errorId}
              message={errors.matchHost?.message ? t(errors.matchHost.message) : undefined}
            />
          </div>

          {/* Auth Username */}
          <div className="space-y-1.5">
            <Label htmlFor="trunk-authUsername">{t('trunks.authUsername')}</Label>
            <Input
              id="trunk-authUsername"
              autoComplete="off"
              placeholder={t('trunks.form.auth_username_placeholder')}
              data-testid="trunk-form-authUsername"
              {...register('authUsername')}
            />
          </div>

          {/* Auth Password (write-only, never prefilled) */}
          <div className="space-y-1.5">
            <Label htmlFor="trunk-authPassword">{t('trunks.authPassword')}</Label>
            <Input
              id="trunk-authPassword"
              type="password"
              autoComplete="new-password"
              placeholder={
                mode === 'edit'
                  ? t('trunks.form.auth_password_edit_placeholder')
                  : t('trunks.form.auth_password_placeholder')
              }
              data-testid="trunk-form-authPassword"
              {...register('authPassword')}
            />
            <p className="text-xs text-muted-foreground">{t('trunks.form.auth_password_hint')}</p>
          </div>

          {/* Registration URI */}
          <div className="space-y-1.5">
            <Label htmlFor="trunk-registrationUri">{t('trunks.registrationUri')}</Label>
            <Input
              id="trunk-registrationUri"
              placeholder={t('trunks.form.registration_uri_placeholder')}
              data-testid="trunk-form-registrationUri"
              {...register('registrationUri')}
            />
          </div>

          {/* Client URI */}
          <div className="space-y-1.5">
            <Label htmlFor="trunk-clientUri">{t('trunks.clientUri')}</Label>
            <Input
              id="trunk-clientUri"
              placeholder={t('trunks.form.client_uri_placeholder')}
              data-testid="trunk-form-clientUri"
              {...register('clientUri')}
            />
          </div>

          {/* Is Active */}
          <div className="flex items-center gap-3">
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  id="trunk-isActive"
                  data-testid="trunk-form-isActive"
                />
              )}
            />
            <Label htmlFor="trunk-isActive">{t('trunks.form.active')}</Label>
          </div>

          {/* Advanced section (collapsed by default) */}
          <div className="border-t pt-2">
            <button
              type="button"
              className="flex w-full items-center gap-1.5 text-sm font-medium text-foreground"
              aria-expanded={advancedOpen}
              aria-controls="trunk-advanced-section"
              data-testid="trunk-form-advanced-toggle"
              onClick={() => setAdvancedOpen((v) => !v)}
            >
              {advancedOpen ? (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              )}
              {t('trunks.form.advanced')}
            </button>

            {advancedOpen && (
              <div
                id="trunk-advanced-section"
                className="mt-3 space-y-4"
                data-testid="trunk-form-advanced-section"
              >
                {/* Codecs */}
                <div className="space-y-1.5">
                  <Label id="trunk-codecs-label">{t('trunks.codecs')}</Label>
                  <Controller
                    name="codecs"
                    control={control}
                    render={({ field }) => (
                      <CodecSelector
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        testId="trunk-form-codecs"
                        ariaLabelledBy="trunk-codecs-label"
                      />
                    )}
                  />
                </div>

                {/* Transport */}
                <div className="space-y-1.5">
                  <Label>{t('trunks.transport')}</Label>
                  <Controller
                    name="transport"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value || undefined} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full" data-testid="trunk-form-transport">
                          <SelectValue placeholder={t('trunks.form.transport_placeholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {TRANSPORTS.map((tr) => (
                            <SelectItem key={tr} value={tr}>
                              {tr}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <p className="text-xs text-muted-foreground">{t('trunks.form.transport_hint')}</p>
                </div>

                {/* Context */}
                <div className="space-y-1.5">
                  <Label htmlFor="trunk-context">{t('trunks.context')}</Label>
                  <Input
                    id="trunk-context"
                    placeholder={t('trunks.form.context_placeholder')}
                    data-testid="trunk-form-context"
                    {...register('context')}
                  />
                  <p className="text-xs text-muted-foreground">{t('trunks.form.context_hint')}</p>
                </div>
              </div>
            )}
          </div>

          <SheetFooter className="mt-auto px-0">
            <Button type="submit" disabled={isSubmitting} data-testid="trunk-form-submit">
              {mode === 'create' ? t('trunks.form.submit_create') : t('trunks.form.submit_edit')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
