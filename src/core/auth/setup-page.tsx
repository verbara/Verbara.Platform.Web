import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Copy, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { FieldError } from '@/core/ui/field-error';
import { useFieldA11y } from '@/core/hooks/use-field-a11y';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/core/ui/dialog';
import { useSetup, type SetupResponse } from '@/core/api/hooks/use-system';

const setupSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().optional(),
  platformName: z.string().optional(),
});

type SetupFormValues = z.infer<typeof setupSchema>;

export default function SetupPage() {
  const navigate = useNavigate();
  const setup = useSetup();
  const [apiKeyResponse, setApiKeyResponse] = useState<SetupResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetupFormValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: { email: '', password: '', displayName: '', platformName: '' },
  });

  const emailA11y = useFieldA11y(errors.email, 'email', { required: true });
  const passwordA11y = useFieldA11y(errors.password, 'password', { required: true });

  const onSubmit = handleSubmit((values) => {
    setup.mutate(values, {
      onSuccess: (response) => {
        setApiKeyResponse(response);
      },
    });
  });

  const handleCopyKey = async () => {
    if (!apiKeyResponse) return;
    await navigator.clipboard.writeText(apiKeyResponse.managementApiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDone = () => {
    toast.success('Platform initialized successfully');
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Building2 className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-4 text-2xl font-bold">Platform Setup</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Configure your contact center platform
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          <fieldset className="space-y-4">
            <legend className="text-sm font-medium">Admin Account</legend>
            <div className="space-y-1.5">
              <Label htmlFor="email" required>
                Email
              </Label>
              <Input
                id="email"
                type="email"
                data-testid="setup-email"
                {...emailA11y.inputProps}
                {...register('email')}
              />
              <FieldError id={emailA11y.errorId} message={errors.email?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" required>
                Password
              </Label>
              <Input
                id="password"
                type="password"
                data-testid="setup-password"
                {...passwordA11y.inputProps}
                {...register('password')}
              />
              <FieldError id={passwordA11y.errorId} message={errors.password?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                data-testid="setup-display-name"
                {...register('displayName')}
              />
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-medium">Platform</legend>
            <div className="space-y-1.5">
              <Label htmlFor="platformName">Platform Name</Label>
              <Input
                id="platformName"
                data-testid="setup-platform-name"
                placeholder="My Contact Center"
                {...register('platformName')}
              />
            </div>
          </fieldset>

          {setup.isError && (
            <p className="text-sm text-destructive" data-testid="setup-error">
              {setup.error?.message ?? 'Setup failed. The platform may already be configured.'}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            data-testid="setup-submit"
            disabled={setup.isPending}
          >
            {setup.isPending ? 'Initializing...' : 'Initialize Platform'}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Already configured?{' '}
          <a href="/login" className="text-primary underline">
            Sign in
          </a>
        </p>
      </div>

      <Dialog open={apiKeyResponse !== null} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" data-testid="api-key-dialog" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Management API Key</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Save this key now — it cannot be retrieved again.
          </p>
          <div className="flex items-center gap-2 rounded border bg-muted p-3">
            <code className="flex-1 break-all text-xs" data-testid="api-key-value">
              {apiKeyResponse?.managementApiKey}
            </code>
            <Button variant="ghost" size="sm" onClick={handleCopyKey}>
              {copied ? <CheckCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={handleDone} data-testid="api-key-done">
              I&apos;ve saved my key — Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
