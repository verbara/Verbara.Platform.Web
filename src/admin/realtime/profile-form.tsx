import { useEffect } from 'react';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
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
            <Label htmlFor="profile-name">{t('realtime.form.name')}</Label>
            <Input
              id="profile-name"
              placeholder={t('realtime.form.name_placeholder')}
              aria-invalid={!!errors.name}
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{t(errors.name.message ?? '')}</p>
            )}
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
            <Label htmlFor="profile-transport">{t('realtime.form.transport')}</Label>
            <Input
              id="profile-transport"
              placeholder="transport-udp"
              aria-invalid={!!errors.transport}
              {...register('transport')}
            />
            {errors.transport && (
              <p className="text-xs text-destructive">{t(errors.transport.message ?? '')}</p>
            )}
          </div>

          {/* Codecs */}
          <div className="space-y-1.5">
            <Label htmlFor="profile-codecs">{t('realtime.form.codecs')}</Label>
            <Input
              id="profile-codecs"
              placeholder="ulaw,alaw,g722"
              aria-invalid={!!errors.codecs}
              {...register('codecs')}
            />
            {errors.codecs && (
              <p className="text-xs text-destructive">{t(errors.codecs.message ?? '')}</p>
            )}
          </div>

          {/* Max Contacts */}
          <div className="space-y-1.5">
            <Label htmlFor="profile-maxContacts">{t('realtime.form.max_contacts')}</Label>
            <Input
              id="profile-maxContacts"
              type="number"
              min={1}
              placeholder="1"
              aria-invalid={!!errors.maxContacts}
              {...register('maxContacts')}
            />
            {errors.maxContacts && (
              <p className="text-xs text-destructive">{t(errors.maxContacts.message ?? '')}</p>
            )}
          </div>

          {/* Context */}
          <div className="space-y-1.5">
            <Label htmlFor="profile-context">{t('realtime.form.context')}</Label>
            <Input
              id="profile-context"
              placeholder="from-internal"
              aria-invalid={!!errors.context}
              {...register('context')}
            />
            {errors.context && (
              <p className="text-xs text-destructive">{t(errors.context.message ?? '')}</p>
            )}
          </div>

          {/* Qualify Frequency */}
          <div className="space-y-1.5">
            <Label htmlFor="profile-qualifyFrequency">{t('realtime.form.qualify_frequency')}</Label>
            <Input
              id="profile-qualifyFrequency"
              type="number"
              min={0}
              placeholder="30"
              aria-invalid={!!errors.qualifyFrequency}
              {...register('qualifyFrequency')}
            />
            {errors.qualifyFrequency && (
              <p className="text-xs text-destructive">{t(errors.qualifyFrequency.message ?? '')}</p>
            )}
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
