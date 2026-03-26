import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Switch } from '@/core/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/ui/select';
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
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['agent', 'trunk']),
  transport: z.string().min(1, 'Transport is required'),
  codecs: z.string().min(1, 'Codecs are required'),
  maxContacts: z.coerce.number().int().min(1, 'Must be at least 1'),
  webrtc: z.boolean(),
  directMedia: z.boolean(),
  context: z.string().min(1, 'Context is required'),
  qualifyFrequency: z.coerce.number().int().min(0, 'Must be 0 or greater'),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  profile?: EndpointProfile;
}

export function ProfileForm({ open, onOpenChange, mode, profile }: ProfileFormProps) {
  const createProfile = useCreateEndpointProfile();
  const updateProfile = useUpdateEndpointProfile();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema) as any,
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

  const title = mode === 'create' ? 'Add Endpoint Profile' : 'Edit Endpoint Profile';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === 'create'
              ? 'Configure a new PJSIP endpoint profile template.'
              : 'Update endpoint profile configuration.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleFormSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              placeholder="SIP Agent"
              aria-invalid={!!errors.name}
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROFILE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Transport */}
          <div className="space-y-1.5">
            <Label htmlFor="profile-transport">Transport</Label>
            <Input
              id="profile-transport"
              placeholder="transport-udp"
              aria-invalid={!!errors.transport}
              {...register('transport')}
            />
            {errors.transport && (
              <p className="text-xs text-destructive">{errors.transport.message}</p>
            )}
          </div>

          {/* Codecs */}
          <div className="space-y-1.5">
            <Label htmlFor="profile-codecs">Codecs</Label>
            <Input
              id="profile-codecs"
              placeholder="ulaw,alaw,g722"
              aria-invalid={!!errors.codecs}
              {...register('codecs')}
            />
            {errors.codecs && (
              <p className="text-xs text-destructive">{errors.codecs.message}</p>
            )}
          </div>

          {/* Max Contacts */}
          <div className="space-y-1.5">
            <Label htmlFor="profile-maxContacts">Max Contacts</Label>
            <Input
              id="profile-maxContacts"
              type="number"
              min={1}
              placeholder="1"
              aria-invalid={!!errors.maxContacts}
              {...register('maxContacts')}
            />
            {errors.maxContacts && (
              <p className="text-xs text-destructive">{errors.maxContacts.message}</p>
            )}
          </div>

          {/* Context */}
          <div className="space-y-1.5">
            <Label htmlFor="profile-context">Context</Label>
            <Input
              id="profile-context"
              placeholder="from-internal"
              aria-invalid={!!errors.context}
              {...register('context')}
            />
            {errors.context && (
              <p className="text-xs text-destructive">{errors.context.message}</p>
            )}
          </div>

          {/* Qualify Frequency */}
          <div className="space-y-1.5">
            <Label htmlFor="profile-qualifyFrequency">Qualify Frequency (s)</Label>
            <Input
              id="profile-qualifyFrequency"
              type="number"
              min={0}
              placeholder="30"
              aria-invalid={!!errors.qualifyFrequency}
              {...register('qualifyFrequency')}
            />
            {errors.qualifyFrequency && (
              <p className="text-xs text-destructive">{errors.qualifyFrequency.message}</p>
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
            <Label htmlFor="profile-webrtc">WebRTC</Label>
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
            <Label htmlFor="profile-directMedia">Direct Media</Label>
          </div>

          <SheetFooter className="mt-auto px-0">
            <Button type="submit" disabled={isSubmitting}>
              {mode === 'create' ? 'Add Profile' : 'Save Changes'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
