import { useNavigate } from 'react-router-dom';
import { Button } from '@/core/ui/button';

export default function UnauthorizedPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
          403 — Unauthorized
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Your role doesn&apos;t have access
        </p>
        <Button onClick={() => navigate('/')}>Go Home</Button>
      </div>
    </div>
  );
}
