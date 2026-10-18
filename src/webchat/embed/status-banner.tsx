import { useTranslation } from 'react-i18next';

/**
 * `error`: the widget could not start a session and is retrying; the visitor can still type (#426).
 * `unavailable`: the tenant's WebChat channel is off; the widget stops and the visitor cannot type.
 */
export type Status =
  | 'connecting'
  | 'online'
  | 'offline'
  | 'reconnecting'
  | 'typing'
  | 'timeout'
  | 'error'
  | 'unavailable';

export function StatusBanner({ status }: { status: Status }) {
  const { t } = useTranslation('webchat');
  const message =
    status === 'error'
      ? t('errors.sessionFailed')
      : status === 'unavailable'
        ? t('errors.unavailable')
        : t(`status.${status}`);
  const tone =
    status === 'error' || status === 'unavailable'
      ? 'bg-red-50 text-red-800 border-red-200'
      : status === 'online'
        ? 'bg-green-50 text-green-800 border-green-200'
        : status === 'offline'
          ? 'bg-gray-50 text-gray-700 border-gray-200'
          : status === 'reconnecting' || status === 'connecting'
            ? 'bg-amber-50 text-amber-800 border-amber-200'
            : status === 'typing'
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'bg-yellow-50 text-yellow-800 border-yellow-200';

  return (
    <div role="status" className={`border-b px-3 py-1.5 text-xs ${tone}`}>
      {message}
    </div>
  );
}
