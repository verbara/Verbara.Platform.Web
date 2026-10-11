import { useTranslation } from 'react-i18next';
import { CircleAlert, CircleCheckBig, LoaderCircle, Plug } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { useTestChannel, type ChannelTestResult } from '@/core/api/hooks/use-channels';

interface ChannelTestButtonProps {
  channelId: string;
}

/** The failure codes Platform's connection test reports, each with its own localized line. */
const KNOWN_TEST_CODES = new Set([
  'provider-rejected',
  'provider-unreachable',
  'channel-not-configured',
  'not-testable',
]);

/** The i18n key of a test outcome's headline; an unknown code falls back to the generic failure. */
function testOutcomeKey(result: ChannelTestResult): string {
  if (result.success) {
    return result.verifiedName ? 'admin:channels.test.successNamed' : 'admin:channels.test.success';
  }
  return result.code && KNOWN_TEST_CODES.has(result.code)
    ? `admin:channels.test.codes.${result.code}`
    : 'admin:channels.test.failed';
}

/**
 * Whether the result's `message` is shown under the headline. Only `provider-rejected` carries the
 * provider's own words (redacted and capped by Platform); for the other known codes `message` is
 * Platform's fixed English text, which the localized headline already covers (ADR-0013). An unknown
 * or missing code has no localized line, so its text is the only detail there is.
 */
function showsMessage(result: ChannelTestResult): boolean {
  if (result.success || !result.message) return false;
  return result.code === 'provider-rejected' || !result.code || !KNOWN_TEST_CODES.has(result.code);
}

function TestOutcome({ result }: Readonly<{ result: ChannelTestResult }>) {
  const { t } = useTranslation(['admin']);
  const Icon = result.success ? CircleCheckBig : CircleAlert;
  return (
    <div
      role="status"
      data-channel-test-result
      data-test-outcome={result.success ? 'success' : 'failure'}
      data-test-code={result.success ? undefined : (result.code ?? 'unknown')}
      className={`flex gap-2 rounded-lg border p-3 text-sm ${
        result.success ? 'border-green-500/40' : 'border-destructive/40'
      }`}
    >
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${result.success ? 'text-green-600' : 'text-destructive'}`}
      />
      <div className="space-y-1">
        <p
          data-channel-test-verified-name={
            result.success && result.verifiedName ? result.verifiedName : undefined
          }
        >
          {t(testOutcomeKey(result), { name: result.verifiedName ?? '' })}
        </p>
        {showsMessage(result) && (
          <p className="break-words text-xs text-muted-foreground" data-channel-test-message>
            {result.message}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Runs `POST /admin/channels/{channel}/test` against what is saved for the tenant and shows the
 * server's outcome: the verified name on success; on failure the code's localized line, plus the
 * provider's own message when the provider rejected the configuration.
 */
export function ChannelTestButton({ channelId }: ChannelTestButtonProps) {
  const { t } = useTranslation(['admin']);
  const test = useTestChannel();

  return (
    <div className="space-y-2" data-channel-test>
      <Button
        type="button"
        variant="outline"
        disabled={test.isPending}
        onClick={() => test.mutate(channelId)}
      >
        {test.isPending ? (
          <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Plug className="mr-1.5 h-4 w-4" />
        )}
        {t('admin:channels.test_connection')}
      </Button>
      {test.data && !test.isPending && <TestOutcome result={test.data} />}
    </div>
  );
}
