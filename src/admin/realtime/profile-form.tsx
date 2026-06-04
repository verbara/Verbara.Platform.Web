import { useEffect } from 'react';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
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
  useCreateEndpointProfile,
  useUpdateEndpointProfile,
  type EndpointProfile,
} from '@/core/api/hooks/use-endpoint-profiles';
import { CodecSelector } from '@/core/voice/codec-selector';

const PROFILE_TYPES = ['agent', 'trunk'] as const;

const profileSchema = z.object({
  name: z.string().min(1, 'admin:realtime.validation.nameRequired'),
  type: z.enum(['agent', 'trunk']),
  transport: z.string().min(1, 'admin:realtime.validation.transportRequired'),
  codecs: z.string().min(1, 'admin:realtime.validation.codecsRequired'),
  maxContacts: z.coerce.number().int().min(1, 'admin:realtime.validation.maxContactsAtLeastOne'),
  webrtc: z.boolean(),
  directMedia: z.boolean(),
  context: z.string().min(1, 'admin:realtime.validation.contextRequired'),
  qualifyFrequency: z.coerce
    .number()
    .int()
    .min(0, 'admin:realtime.validation.qualifyFrequencyAtLeastZero'),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  profile?: EndpointProfile;
}

export function ProfileForm({ open, onOpenChange, mode, profile }: ProfileFormProps) {
  const { t } = useTranslation('admin');
  const createProfile = useCreateEndpointProfile();
  const updateProfile = useUpdateEndpointProfile();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema) as Resolver<ProfileFormValues>,
    defaultValues: {
      name: '',
      type: 'agent',
      transport: 'transport-udp',
      codecs: 'ulaw,alaw,g722',
      maxContacts: 1,
      webrtc: false,
      directMedia: false,
      context: 'from-internal',
      qualifyFrequency: 30,
    },
  });

  const nameA11y = useFieldA11y(errors.name, 'profile-name', { required: true });
  const transportA11y = useFieldA11y(errors.transport, 'profile-transport', { required: true });
  const codecsA11y = useFieldA11y(errors.codecs, 'profile-codecs', { required: true });
  const maxContactsA11y = useFieldA11y(errors.maxContacts, 'profile-maxContacts', {
    required: true,
  });
  const contextA11y = useFieldA11y(errors.context, 'profile-context', { required: true });
  const qualifyA11y = useFieldA11y(errors.qualifyFrequency, 'profile-qualifyFrequency', {
    required: true,
  });

  useEffect(() => {
    if (open) {
      reset(
        profile
          ? {
              name: profile.name,
              type: profile.type as ProfileFormValues['type'],
              transport: profile.transport,
              codecs: profile.codecs,
              maxContacts: profile.maxContacts,
              webrtc: profile.webrtc,
              directMedia: profile.directMedia,
              context: profile.context,
              qualifyFrequency: profile.qualifyFrequency,
            }
          : {
              name: '',
              type: 'agent',
              transport: 'transport-udp',
              codecs: 'ulaw,alaw,g722',
              maxContacts: 1,
              webrtc: false,
              directMedia: false,
              context: 'from-internal',
              qualifyFrequency: 30,
            },
      );
    }
  }, [open, profile, reset]);

  const handleFormSubmit = handleSubmit((values) => {
    if (mode === 'edit' && profile) {
      updateProfile.mutate({ id: profile.id, ...values });
    } else {
      createProfile.mutate(values);
    }
    onOpenChange(false);
  });

  const title = mode === 'create' ? t('realtime.form.create_title') : t('realtime.form.edit_title');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === 'create'
              ? t('realtime.form.create_description')
              : t('realtime.form.edit_description')}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleFormSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="profile-name" required>
              {t('realtime.form.name')}
            </Label>
            <Input
              id="profile-name"
              placeholder={t('realtime.form.name_placeholder')}
              {...nameA11y.inputProps}
              {...register('name')}
            />
            <FieldError
              id={nameA11y.errorId}
              message={errors.name?.message ? t(errors.name.message) : undefined}
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label>{t('realtime.form.type')}</Label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('realtime.form.select_type')} />
                  </SelectTrigger>
                  <SelectContent>
                    {PROFILE_TYPES.map((pt) => (
                      <SelectItem key={pt} value={pt}>
                        {pt === 'agent'
                          ? t('realtime.form.type_agent')
                          : t('realtime.form.type_trunk')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Transport */}
          <div className="space-y-1.5">
            <Label htmlFor="profile-transport" required>
              {t('realtime.form.transport')}
            </Label>
            <Input
              id="profile-transport"
              placeholder="transport-udp"
              {...transportA11y.inputProps}
              {...register('transport')}
            />
            <FieldError
              id={transportA11y.errorId}
              message={errors.transport?.message ? t(errors.transport.message) : undefined}
            />
          </div>

          {/* Codecs */}
          <div className="space-y-1.5">
            <Label id="profile-codecs-label" required>
              {t('realtime.form.codecs')}
            </Label>
            <Controller
              name="codecs"
              control={control}
              render={({ field }) => (
                <CodecSelector
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  testId="profile-codecs"
                  ariaLabelledBy="profile-codecs-label"
                  ariaDescribedBy={codecsA11y.errorId}
                />
              )}
            />
            <FieldError
              id={codecsA11y.errorId}
              message={errors.codecs?.message ? t(errors.codecs.message) : undefined}
            />
          </div>

          {/* Max Contacts */}
          <div className="space-y-1.5">
            <Label htmlFor="profile-maxContacts" required>
              {t('realtime.form.max_contacts')}
            </Label>
            <Input
              id="profile-maxContacts"
              type="number"
              min={1}
              placeholder="1"
              {...maxContactsA11y.inputProps}
              {...register('maxContacts')}
            />
            <FieldError
              id={maxContactsA11y.errorId}
              message={errors.maxContacts?.message ? t(errors.maxContacts.message) : undefined}
            />
          </div>

          {/* Context */}
          <div className="space-y-1.5">
            <Label htmlFor="profile-context" required>
              {t('realtime.form.context')}
            </Label>
            <Input
              id="profile-context"
              placeholder="from-internal"
              {...contextA11y.inputProps}
              {...register('context')}
            />
            <FieldError
              id={contextA11y.errorId}
              message={errors.context?.message ? t(errors.context.message) : undefined}
            />
          </div>

          {/* Qualify Frequency */}
          <div className="space-y-1.5">
            <Label htmlFor="profile-qualifyFrequency" required>
              {t('realtime.form.qualify_frequency')}
            </Label>
            <Input
              id="profile-qualifyFrequency"
              type="number"
              min={0}
              placeholder="30"
              {...qualifyA11y.inputProps}
              {...register('qualifyFrequency')}
            />
            <FieldError
              id={qualifyA11y.errorId}
              message={
                errors.qualifyFrequency?.message ? t(errors.qualifyFrequency.message) : undefined
              }
            />
          </div>

          {/* WebRTC */}
          <div className="flex items-center gap-3">
            <Controller
              name="webrtc"
              control={control}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  id="profile-webrtc"
                />
              )}
            />
            <Label htmlFor="profile-webrtc">{t('realtime.form.webrtc')}</Label>
          </div>

          {/* Direct Media */}
          <div className="flex items-center gap-3">
            <Controller
              name="directMedia"
              control={control}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  id="profile-directMedia"
                />
              )}
            />
            <Label htmlFor="profile-directMedia">{t('realtime.form.direct_media')}</Label>
          </div>

          <SheetFooter className="mt-auto px-0">
            <Button type="submit" disabled={isSubmitting}>
              {mode === 'create'
                ? t('realtime.form.submit_create')
                : t('realtime.form.submit_edit')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
