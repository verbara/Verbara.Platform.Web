import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoaderCircle, Plug, CircleCheck, CircleX } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/core/ui/button';
import {
  useTestLlmConnection,
  type TestLlmConnectionInput,
  type TestLlmConnectionResult,
} from '@/core/api/hooks/use-typification-llm';

interface LlmTestButtonProps {
  /**
   * Produces the draft to probe. Return `{}` to probe the SAVED config, or a
   * partial draft (any field) to probe an unsaved draft. Called lazily on click
   * so the latest form values are used.
   */
  getDraft: () => TestLlmConnectionInput;
}

/**
 * "Probar conexión" button. Fires the (non-gated) test probe and renders the
 * structured result inline: reachable / authOk / modelOk + latency, or the
 * server `error` string. Mirrors `channel-test-button.tsx` but surfaces the
 * richer probe shape instead of a single toast.
 */
export function LlmTestButton({ getDraft }: LlmTestButtonProps) {
  const { t } = useTranslation(['admin', 'common']);
  const test = useTestLlmConnection();
  const [result, setResult] = useState<TestLlmConnectionResult | null>(null);
  const [failed, setFailed] = useState(false);

  const handleTest = () => {
    setResult(null);
    setFailed(false);
    test.mutate(getDraft(), {
      onSuccess: (r) => {
        setResult(r);
        const ok = r.reachable && r.authOk && r.modelOk;
        if (ok) toast.success(t('common:toasts.typification.llmTestPassed'));
        else toast.error(t('common:toasts.typification.llmTestFailed'));
      },
      onError: () => {
        setFailed(true);
        toast.error(t('common:toasts.typification.llmTestFailed'));
      },
    });
  };

  return (
    <div className="space-y-2" data-testid="llm-test">
      <Button
        type="button"
        variant="outline"
        disabled={test.isPending}
        onClick={handleTest}
        data-testid="llm-test-button"
      >
        {test.isPending ? (
          <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Plug className="mr-1.5 h-4 w-4" />
        )}
        {t('admin:typification.llm.test.button')}
      </Button>

      {failed && (
        <p className="text-sm text-destructive" data-testid="llm-test-error">
          {t('admin:typification.llm.test.requestFailed')}
        </p>
      )}

      {result && (
        <div className="rounded-md border p-3 text-sm" data-testid="llm-test-result">
          <ResultRow label={t('admin:typification.llm.test.reachable')} ok={result.reachable} />
          <ResultRow label={t('admin:typification.llm.test.authOk')} ok={result.authOk} />
          <ResultRow label={t('admin:typification.llm.test.modelOk')} ok={result.modelOk} />
          <p className="mt-1 text-xs text-muted-foreground">
            {t('admin:typification.llm.test.latency', { ms: result.latencyMs })}
          </p>
          {result.error && (
            <p className="mt-1 text-xs text-destructive" data-testid="llm-test-result-error">
              {result.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ResultRow({ label, ok }: Readonly<{ label: string; ok: boolean }>) {
  return (
    <div className="flex items-center gap-1.5">
      {ok ? (
        <CircleCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <CircleX className="h-4 w-4 text-destructive" />
      )}
      <span>{label}</span>
    </div>
  );
}
