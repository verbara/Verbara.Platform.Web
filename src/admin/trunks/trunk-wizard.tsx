import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm, FormProvider, useFormContext, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { WizardLayout, type WizardStep } from '@/core/ui/wizard-layout';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Switch } from '@/core/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import { useCreateTrunk, type TrunkWriteFields } from '@/core/api/hooks/use-trunks';
import { useCreateRoute, useRoutes, type OutboundRouteSummary } from '@/core/api/hooks/use-routes';
import { useCreateDidRoute, type CreateDidRouteFields } from '@/core/api/hooks/use-did-routes';
import { useQueues } from '@/core/api/hooks/use-queues';
import { CodecSelector } from '@/core/voice/codec-selector';
import {
  PROVIDER_TEMPLATES,
  PROVIDER_ORDER,
  type AuthMode,
  type ProviderId,
} from './trunk-wizard-providers';

// ── Validation regexes (mirror the flat trunk-form + did-route-form) ────────────
const IPV4_CIDR =
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}(\/(3[0-2]|[12]?\d))?$/;
const IPV6_CIDR = /^([0-9a-fA-F:]+)(\/(12[0-8]|1[01]\d|\d?\d))?$/;
// Same E.164 contract the backend enforces (`^\+?[1-9]\d{6,14}$`).
const E164 = /^\+?[1-9]\d{6,14}$/;

function isValidHostOrCidr(value: string): boolean {
  if (IPV4_CIDR.test(value)) return true;
  return value.includes(':') && IPV6_CIDR.test(value);
}

// Provider templates (PROVIDER_TEMPLATES / PROVIDER_ORDER) + the AuthMode /
// ProviderId types live in ./trunk-wizard-providers so this file only exports
// the wizard component (react-refresh/only-export-components).

// Transports the wizard exposes. `transport-wss` (TLS/SRTP) is intentionally
// disabled until SRTP support lands — see the inline note in MediaStep.
const TRANSPORTS = ['transport-udp', 'transport-tcp', 'transport-ws', 'transport-wss'] as const;

// ── Wizard form shape (collected across steps, created on Finish) ─────────────
export interface TrunkWizardValues {
  // Step 1
  providerId: ProviderId | '';
  // Step 2
  name: string;
  maxChannels: number;
  authMode: AuthMode;
  matchHost: string;
  authUsername: string;
  authPassword: string;
  registrationUri: string;
  clientUri: string;
  // Step 3
  codecs: string;
  transport: string;
  // Step 4 (outbound route — skippable)
  addOutboundRoute: boolean;
  routePattern: string;
  routeDialPrefix: string;
  // Step 5 (DID / inbound — skippable, but queue mandatory if a DID is set)
  addDid: boolean;
  did: string;
  didQueueId: string;
  // Step 6
  isActive: boolean;
}

const EMPTY_DEFAULTS: TrunkWizardValues = {
  providerId: '',
  name: '',
  maxChannels: 10,
  authMode: 'ip-acl',
  matchHost: '',
  authUsername: '',
  authPassword: '',
  registrationUri: '',
  clientUri: '',
  codecs: '',
  transport: '',
  addOutboundRoute: true,
  routePattern: '+',
  routeDialPrefix: '',
  addDid: true,
  did: '',
  didQueueId: '',
  isActive: true,
};

const STEP_KEYS = ['provider', 'connection', 'media', 'outbound', 'inbound', 'review'] as const;
type StepKey = (typeof STEP_KEYS)[number];

// The 7th "connectivity test" step from the design is DEFERRED until its
// backend endpoint lands (P2). We do NOT fabricate a fake fetch — the review
// step just shows a hint to verify with `pjsip show ...`.

function trim(v: string | undefined): string | undefined {
  const s = v?.trim();
  return s ? s : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Provider
// ─────────────────────────────────────────────────────────────────────────────
function ProviderStep() {
  const { t } = useTranslation('admin');
  const {
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<TrunkWizardValues>();
  const selected = watch('providerId');

  const select = (id: ProviderId) => {
    const tpl = PROVIDER_TEMPLATES[id];
    setValue('providerId', id, { shouldValidate: false });
    // Seed provider-specific defaults. Generic keeps whatever the operator
    // already had so re-selecting it isn't destructive.
    setValue('authMode', tpl.authMode);
    setValue('codecs', tpl.codecs);
  };

  return (
    <div className="space-y-4" data-testid="trunk-wizard-provider-step">
      <p className="text-sm text-muted-foreground">{t('trunks.wizard.provider.description')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {PROVIDER_ORDER.map((id) => {
          const isSelected = selected === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => select(id)}
              aria-pressed={isSelected}
              data-testid={`trunk-wizard-provider-${id}`}
              className={`flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors ${
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:bg-muted'
              }`}
            >
              <span className="font-medium text-foreground">
                {t(`trunks.wizard.providers.${id}.name`)}
              </span>
              <span className="text-xs text-muted-foreground">
                {t(`trunks.wizard.providers.${id}.hint`)}
              </span>
              <span className="mt-1 text-[0.7rem] font-medium uppercase tracking-wide text-primary">
                {t(`trunks.wizard.authMode.${PROVIDER_TEMPLATES[id].authMode}`)}
              </span>
            </button>
          );
        })}
      </div>
      {errors.providerId?.message && (
        <p
          className="text-xs text-destructive"
          role="alert"
          data-testid="trunk-wizard-provider-error"
        >
          {t(errors.providerId.message)}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Connection + Authentication
// ─────────────────────────────────────────────────────────────────────────────
function ConnectionStep() {
  const { t } = useTranslation('admin');
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext<TrunkWizardValues>();
  const providerId = (watch('providerId') || 'generic') as ProviderId;
  const tpl = PROVIDER_TEMPLATES[providerId];
  const authMode = watch('authMode');

  return (
    <div className="space-y-4" data-testid="trunk-wizard-connection-step">
      <div className="space-y-1.5">
        <Label htmlFor="trunk-wizard-name" required>
          {t('trunks.name')}
        </Label>
        <Input
          id="trunk-wizard-name"
          placeholder={t('trunks.form.name_placeholder')}
          data-testid="trunk-wizard-name"
          {...register('name')}
        />
        {errors.name?.message && (
          <p className="text-xs text-destructive" role="alert">
            {t(errors.name.message)}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="trunk-wizard-maxChannels" required>
          {t('trunks.maxChannels')}
        </Label>
        <Input
          id="trunk-wizard-maxChannels"
          type="number"
          min={1}
          placeholder="10"
          data-testid="trunk-wizard-maxChannels"
          {...register('maxChannels')}
        />
        {errors.maxChannels?.message && (
          <p className="text-xs text-destructive" role="alert">
            {t(errors.maxChannels.message)}
          </p>
        )}
      </div>

      {/* Generic providers let the operator pick the auth mode first. */}
      {tpl.askAuthMode && (
        <div className="space-y-1.5">
          <Label>{t('trunks.wizard.connection.authModeLabel')}</Label>
          <Controller
            name="authMode"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full" data-testid="trunk-wizard-authMode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ip-acl">{t('trunks.wizard.authMode.ip-acl')}</SelectItem>
                  <SelectItem value="register">{t('trunks.wizard.authMode.register')}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      )}

      {authMode === 'ip-acl' ? (
        <div className="space-y-1.5">
          <Label htmlFor="trunk-wizard-matchHost" required>
            {t('trunks.matchHost')}
          </Label>
          <Input
            id="trunk-wizard-matchHost"
            placeholder={t('trunks.form.match_host_placeholder')}
            data-testid="trunk-wizard-matchHost"
            {...register('matchHost')}
          />
          <p className="text-xs text-muted-foreground">
            {t(`trunks.wizard.providers.${providerId}.ipHint`)}
          </p>
          {errors.matchHost?.message && (
            <p className="text-xs text-destructive" role="alert">
              {t(errors.matchHost.message)}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="trunk-wizard-authUsername" required>
              {t('trunks.authUsername')}
            </Label>
            <Input
              id="trunk-wizard-authUsername"
              autoComplete="off"
              placeholder={t('trunks.form.auth_username_placeholder')}
              data-testid="trunk-wizard-authUsername"
              {...register('authUsername')}
            />
            {errors.authUsername?.message && (
              <p className="text-xs text-destructive" role="alert">
                {t(errors.authUsername.message)}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trunk-wizard-authPassword" required>
              {t('trunks.authPassword')}
            </Label>
            <Input
              id="trunk-wizard-authPassword"
              type="password"
              autoComplete="new-password"
              placeholder={t('trunks.form.auth_password_placeholder')}
              data-testid="trunk-wizard-authPassword"
              {...register('authPassword')}
            />
            {errors.authPassword?.message && (
              <p className="text-xs text-destructive" role="alert">
                {t(errors.authPassword.message)}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trunk-wizard-registrationUri" required>
              {t('trunks.registrationUri')}
            </Label>
            <Input
              id="trunk-wizard-registrationUri"
              placeholder={t('trunks.form.registration_uri_placeholder')}
              data-testid="trunk-wizard-registrationUri"
              {...register('registrationUri')}
            />
            <p className="text-xs text-muted-foreground">
              {t(`trunks.wizard.providers.${providerId}.credHint`)}
            </p>
            {errors.registrationUri?.message && (
              <p className="text-xs text-destructive" role="alert">
                {t(errors.registrationUri.message)}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trunk-wizard-clientUri">{t('trunks.clientUri')}</Label>
            <Input
              id="trunk-wizard-clientUri"
              placeholder={t('trunks.form.client_uri_placeholder')}
              data-testid="trunk-wizard-clientUri"
              {...register('clientUri')}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Codecs & media (advanced, collapsed by default)
// ─────────────────────────────────────────────────────────────────────────────
function MediaStep() {
  const { t } = useTranslation('admin');
  const { control, watch } = useFormContext<TrunkWizardValues>();
  const [open, setOpen] = useState(false);
  const transport = watch('transport');

  return (
    <div className="space-y-4" data-testid="trunk-wizard-media-step">
      <p className="text-sm text-muted-foreground">{t('trunks.wizard.media.description')}</p>
      <button
        type="button"
        className="flex w-full items-center gap-1.5 text-sm font-medium text-foreground"
        aria-expanded={open}
        data-testid="trunk-wizard-media-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        )}
        {t('trunks.form.advanced')}
      </button>

      {open && (
        <div className="space-y-4" data-testid="trunk-wizard-media-section">
          <div className="space-y-1.5">
            <Label htmlFor="trunk-wizard-codecs">{t('trunks.codecs')}</Label>
            <Controller
              name="codecs"
              control={control}
              render={({ field }) => (
                <CodecSelector
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  testId="trunk-wizard-codecs"
                />
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('trunks.transport')}</Label>
            <Controller
              name="transport"
              control={control}
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full" data-testid="trunk-wizard-transport">
                    <SelectValue placeholder={t('trunks.form.transport_placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSPORTS.map((tr) => (
                      <SelectItem
                        key={tr}
                        value={tr}
                        // TLS/SRTP not supported yet — disable wss so the
                        // operator can't pick a non-functional transport.
                        disabled={tr === 'transport-wss'}
                      >
                        {tr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">{t('trunks.form.transport_hint')}</p>
            {transport === 'transport-wss' && (
              <p className="text-xs text-destructive" role="alert">
                {t('trunks.wizard.media.tlsNotSupported')}
              </p>
            )}
          </div>

          {/* `context` stays the default `from-trunk` and is intentionally NOT
              exposed in the wizard — only the expert flat form edits it. */}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — Outbound route (skippable)
// ─────────────────────────────────────────────────────────────────────────────
function OutboundStep() {
  const { t } = useTranslation('admin');
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext<TrunkWizardValues>();
  const addRoute = watch('addOutboundRoute');

  return (
    <div className="space-y-4" data-testid="trunk-wizard-outbound-step">
      <p className="text-sm text-muted-foreground">{t('trunks.wizard.outbound.description')}</p>

      <div className="flex items-center gap-3">
        <Controller
          name="addOutboundRoute"
          control={control}
          render={({ field }) => (
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              id="trunk-wizard-addOutboundRoute"
              data-testid="trunk-wizard-addOutboundRoute"
            />
          )}
        />
        <Label htmlFor="trunk-wizard-addOutboundRoute">
          {t('trunks.wizard.outbound.addLabel')}
        </Label>
      </div>

      {addRoute ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="trunk-wizard-routePattern" required>
              {t('trunks.wizard.outbound.patternLabel')}
            </Label>
            <Input
              id="trunk-wizard-routePattern"
              placeholder="+"
              data-testid="trunk-wizard-routePattern"
              {...register('routePattern')}
            />
            <p className="text-xs text-muted-foreground">
              {t('trunks.wizard.outbound.patternHint')}
            </p>
            {errors.routePattern?.message && (
              <p className="text-xs text-destructive" role="alert">
                {t(errors.routePattern.message)}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trunk-wizard-routeDialPrefix">
              {t('trunks.wizard.outbound.dialPrefixLabel')}
            </Label>
            <Input
              id="trunk-wizard-routeDialPrefix"
              placeholder="9"
              data-testid="trunk-wizard-routeDialPrefix"
              {...register('routeDialPrefix')}
            />
            <p className="text-xs text-muted-foreground">
              {t('trunks.wizard.outbound.dialPrefixHint')}
            </p>
          </div>
        </>
      ) : (
        <p
          className="rounded-md bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400"
          data-testid="trunk-wizard-outbound-warning"
        >
          {t('trunks.wizard.outbound.skipWarning')}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 5 — DID / inbound route (skippable, queue mandatory if DID set)
// ─────────────────────────────────────────────────────────────────────────────
function InboundStep() {
  const { t } = useTranslation('admin');
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext<TrunkWizardValues>();
  const addDid = watch('addDid');
  const { data: allQueues = [] } = useQueues();
  const queues = allQueues.filter((q) => q.isActive);

  return (
    <div className="space-y-4" data-testid="trunk-wizard-inbound-step">
      <p className="text-sm text-muted-foreground">{t('trunks.wizard.inbound.description')}</p>

      <div className="flex items-center gap-3">
        <Controller
          name="addDid"
          control={control}
          render={({ field }) => (
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              id="trunk-wizard-addDid"
              data-testid="trunk-wizard-addDid"
            />
          )}
        />
        <Label htmlFor="trunk-wizard-addDid">{t('trunks.wizard.inbound.addLabel')}</Label>
      </div>

      {addDid ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="trunk-wizard-did" required>
              {t('didRoutes.did')}
            </Label>
            <Input
              id="trunk-wizard-did"
              placeholder={t('didRoutes.form.did_placeholder')}
              data-testid="trunk-wizard-did"
              {...register('did')}
            />
            <p className="text-xs text-muted-foreground">{t('didRoutes.form.did_hint')}</p>
            {errors.did?.message && (
              <p className="text-xs text-destructive" role="alert">
                {t(errors.did.message)}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label required>{t('didRoutes.queue')}</Label>
            <Controller
              name="didQueueId"
              control={control}
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full" data-testid="trunk-wizard-didQueueId">
                    <SelectValue placeholder={t('didRoutes.form.select_queue')} />
                  </SelectTrigger>
                  <SelectContent>
                    {queues.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">{t('didRoutes.form.queue_hint')}</p>
            {errors.didQueueId?.message && (
              <p className="text-xs text-destructive" role="alert">
                {t(errors.didQueueId.message)}
              </p>
            )}
          </div>
        </>
      ) : (
        <p
          className="rounded-md bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400"
          data-testid="trunk-wizard-inbound-warning"
        >
          {t('trunks.wizard.inbound.skipWarning')}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 6 — Review & activation
// ─────────────────────────────────────────────────────────────────────────────
function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-2 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function ReviewStep() {
  const { t } = useTranslation('admin');
  const { watch, control } = useFormContext<TrunkWizardValues>();
  const v = watch();
  const { data: allQueues = [] } = useQueues();
  const dash = '—';
  const queueName = allQueues.find((q) => q.id === v.didQueueId)?.name ?? v.didQueueId;

  return (
    <div className="space-y-5" data-testid="trunk-wizard-review-step">
      <div className="rounded-lg border p-4">
        <h3 className="mb-2 font-medium text-foreground">
          {t('trunks.wizard.review.trunkSection')}
        </h3>
        <ReviewRow
          label={t('trunks.wizard.review.provider')}
          value={v.providerId ? t(`trunks.wizard.providers.${v.providerId}.name`) : dash}
        />
        <ReviewRow label={t('trunks.name')} value={v.name || dash} />
        <ReviewRow label={t('trunks.maxChannels')} value={String(v.maxChannels)} />
        <ReviewRow
          label={t('trunks.wizard.connection.authModeLabel')}
          value={t(`trunks.wizard.authMode.${v.authMode}`)}
        />
        {v.authMode === 'ip-acl' ? (
          <ReviewRow label={t('trunks.matchHost')} value={v.matchHost || dash} />
        ) : (
          <>
            <ReviewRow label={t('trunks.authUsername')} value={v.authUsername || dash} />
            <ReviewRow label={t('trunks.registrationUri')} value={v.registrationUri || dash} />
          </>
        )}
        <ReviewRow label={t('trunks.codecs')} value={v.codecs || dash} />
        <ReviewRow
          label={t('trunks.transport')}
          value={v.transport || t('trunks.form.transport_placeholder')}
        />
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="mb-2 font-medium text-foreground">
          {t('trunks.wizard.review.outboundSection')}
        </h3>
        {v.addOutboundRoute ? (
          <>
            <ReviewRow
              label={t('trunks.wizard.outbound.patternLabel')}
              value={v.routePattern || dash}
            />
            <ReviewRow
              label={t('trunks.wizard.outbound.dialPrefixLabel')}
              value={v.routeDialPrefix || dash}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t('trunks.wizard.review.skipped')}</p>
        )}
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="mb-2 font-medium text-foreground">
          {t('trunks.wizard.review.inboundSection')}
        </h3>
        {v.addDid ? (
          <>
            <ReviewRow label={t('didRoutes.did')} value={v.did || dash} />
            <ReviewRow label={t('didRoutes.queue')} value={queueName || dash} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t('trunks.wizard.review.skipped')}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Controller
          name="isActive"
          control={control}
          render={({ field }) => (
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              id="trunk-wizard-isActive"
              data-testid="trunk-wizard-isActive"
            />
          )}
        />
        <Label htmlFor="trunk-wizard-isActive">{t('trunks.form.active')}</Label>
      </div>

      {/* Connectivity test is DEFERRED to P2 (no backend endpoint yet). Just a hint. */}
      <p
        className="rounded-md bg-muted p-3 text-xs text-muted-foreground"
        data-testid="trunk-wizard-connectivity-hint"
      >
        {t('trunks.wizard.review.connectivityHint')}
      </p>
    </div>
  );
}

const STEP_COMPONENTS: Record<StepKey, React.ComponentType> = {
  provider: ProviderStep,
  connection: ConnectionStep,
  media: MediaStep,
  outbound: OutboundStep,
  inbound: InboundStep,
  review: ReviewStep,
};

// ─────────────────────────────────────────────────────────────────────────────
// Per-step validation. Returns a list of i18n message keys to attach as errors,
// keyed by field. Empty array = step is valid.
// ─────────────────────────────────────────────────────────────────────────────
type FieldError = { field: keyof TrunkWizardValues; message: string };

function validateStep(stepKey: StepKey, v: TrunkWizardValues): FieldError[] {
  const errs: FieldError[] = [];
  if (stepKey === 'provider') {
    if (!v.providerId)
      errs.push({ field: 'providerId', message: 'trunks.wizard.validation.providerRequired' });
  }
  if (stepKey === 'connection') {
    if (!v.name.trim()) errs.push({ field: 'name', message: 'trunks.validation.nameRequired' });
    if (!v.maxChannels || v.maxChannels < 1)
      errs.push({ field: 'maxChannels', message: 'trunks.validation.maxChannelsAtLeastOne' });
    if (v.authMode === 'ip-acl') {
      if (!v.matchHost.trim())
        errs.push({ field: 'matchHost', message: 'trunks.wizard.validation.matchHostRequired' });
      else if (!isValidHostOrCidr(v.matchHost.trim()))
        errs.push({ field: 'matchHost', message: 'trunks.validation.matchHostInvalid' });
    } else {
      if (!v.authUsername.trim())
        errs.push({
          field: 'authUsername',
          message: 'trunks.wizard.validation.authUsernameRequired',
        });
      if (!v.authPassword.trim())
        errs.push({
          field: 'authPassword',
          message: 'trunks.wizard.validation.authPasswordRequired',
        });
      if (!v.registrationUri.trim())
        errs.push({
          field: 'registrationUri',
          message: 'trunks.wizard.validation.registrationUriRequired',
        });
    }
  }
  if (stepKey === 'outbound' && v.addOutboundRoute) {
    if (!v.routePattern.trim())
      errs.push({ field: 'routePattern', message: 'trunks.wizard.validation.patternRequired' });
  }
  if (stepKey === 'inbound' && v.addDid) {
    if (!v.did.trim())
      errs.push({ field: 'did', message: 'admin:didRoutes.validation.didRequired' });
    else if (!E164.test(v.did.trim()))
      errs.push({ field: 'did', message: 'admin:didRoutes.validation.didInvalid' });
    // The #1 rule: never a DID without a destination queue.
    if (!v.didQueueId)
      errs.push({ field: 'didQueueId', message: 'admin:didRoutes.validation.queueRequired' });
  }
  return errs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Wizard root
// ─────────────────────────────────────────────────────────────────────────────
export default function TrunkWizard() {
  const { t } = useTranslation(['admin', 'common']);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const createTrunk = useCreateTrunk();
  const createRoute = useCreateRoute();
  const createDid = useCreateDidRoute();
  // Read existing routes to compute the next outbound-route priority.
  const { data: allRoutes } = useRoutes();

  const methods = useForm<TrunkWizardValues>({ defaultValues: EMPTY_DEFAULTS });
  const { handleSubmit, getValues, setError, clearErrors } = methods;

  const currentStepKey = STEP_KEYS[step] ?? STEP_KEYS[0];
  const StepComponent = STEP_COMPONENTS[currentStepKey];

  const isBusy = createTrunk.isPending || createRoute.isPending || createDid.isPending;

  // Validate the current step before advancing. Attach errors to react-hook-form
  // so each step body can render them; block navigation if anything fails.
  const runStepValidation = (stepKey: StepKey): boolean => {
    clearErrors();
    const errs = validateStep(stepKey, getValues());
    errs.forEach((e) => setError(e.field, { type: 'manual', message: e.message }));
    return errs.length === 0;
  };

  const goNext = () => {
    if (!runStepValidation(currentStepKey)) return;
    setStep((s) => Math.min(s + 1, STEP_KEYS.length - 1));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const goToStep = (idx: number) => {
    // Allow jumping backward freely; validate before jumping forward.
    if (idx <= step) {
      setStep(idx);
      return;
    }
    if (runStepValidation(currentStepKey)) setStep(idx);
  };

  // Compute the next outbound-route priority: max existing + 10, or 10 if none.
  const nextRoutePriority = (): number => {
    if (!allRoutes || allRoutes.length === 0) return 10;
    return Math.max(...allRoutes.map((r) => r.priority)) + 10;
  };

  const onFinish = handleSubmit(async () => {
    // Re-validate the gated steps (provider/connection/inbound) defensively in
    // case the operator jumped straight to review via the indicator.
    for (const key of ['provider', 'connection', 'outbound', 'inbound'] as StepKey[]) {
      if (!runStepValidation(key)) {
        const idx = STEP_KEYS.indexOf(key);
        setStep(idx);
        return;
      }
    }

    const v = getValues();

    // 1) Create the trunk and await its id.
    const trunkPayload: TrunkWriteFields = {
      name: v.name.trim(),
      displayName: v.name.trim(),
      type: 'PJSIP',
      maxChannels: v.maxChannels,
      isActive: v.isActive,
      codecs: trim(v.codecs),
      transport: trim(v.transport),
      // context stays the server default `from-trunk` (not exposed).
    };
    if (v.authMode === 'ip-acl') {
      trunkPayload.matchHost = trim(v.matchHost);
    } else {
      trunkPayload.authUsername = trim(v.authUsername);
      trunkPayload.authPassword = trim(v.authPassword);
      trunkPayload.registrationUri = trim(v.registrationUri);
      trunkPayload.clientUri = trim(v.clientUri);
    }

    let trunkId: number;
    try {
      const created = await createTrunk.mutateAsync(trunkPayload);
      trunkId = created.id;
    } catch {
      // The hook already toasted the error; keep the operator on the review step.
      return;
    }

    // 2) Create the outbound route (best-effort — surface its own error).
    if (v.addOutboundRoute) {
      const routePayload: Partial<Omit<OutboundRouteSummary, 'id'>> = {
        pattern: v.routePattern.trim() || '+',
        patternType: 'prefix',
        trunkId,
        priority: nextRoutePriority(),
        dialPrefix: trim(v.routeDialPrefix),
      };
      try {
        await createRoute.mutateAsync(routePayload);
      } catch {
        toast.error(t('admin:trunks.wizard.errors.routeFailed'));
        // The trunk DID succeed — tell the operator what landed and bail so they
        // can retry the route from the routes page.
        toast.success(t('admin:trunks.wizard.errors.trunkCreatedOnly'));
        navigate('/admin/trunks');
        return;
      }
    }

    // 3) Create the DID / inbound route (queue is guaranteed non-empty by validation).
    if (v.addDid) {
      const didPayload: CreateDidRouteFields = {
        did: v.did.trim(),
        queueId: v.didQueueId,
        isActive: v.isActive,
      };
      try {
        await createDid.mutateAsync(didPayload);
      } catch {
        toast.error(t('admin:trunks.wizard.errors.didFailed'));
        toast.success(t('admin:trunks.wizard.errors.trunkAndRouteCreated'));
        navigate('/admin/trunks');
        return;
      }
    }

    toast.success(t('admin:trunks.wizard.errors.allCreated'));
    navigate('/admin/trunks');
  });

  const steps: WizardStep[] = STEP_KEYS.map((key) => ({
    key,
    label: t(`admin:trunks.wizard.steps.${key}`),
  }));

  return (
    <FormProvider {...methods}>
      <WizardLayout
        testIdPrefix="trunk-wizard"
        title={t('admin:trunks.wizard.title')}
        description={t('admin:trunks.wizard.subtitle')}
        steps={steps}
        currentStep={step}
        onStepClick={goToStep}
        onBack={goBack}
        onNext={goNext}
        onFinish={onFinish}
        isBusy={isBusy}
        backLabel={t('admin:campaigns.previous')}
        nextLabel={t('admin:campaigns.next')}
        finishLabel={isBusy ? t('admin:trunks.wizard.creating') : t('admin:trunks.wizard.finish')}
      >
        <StepComponent />
      </WizardLayout>
    </FormProvider>
  );
}
