import { useTranslation } from 'react-i18next';

export type Status = 'connecting' | 'online' | 'offline' | 'reconnecting' | 'typing' | 'timeout';

export function StatusBanner({ status }: { status: Status }) {
  const { t } = useTranslation('webchat');
  const message = t(`status.${status}`);
  const tone =
    status === 'online'
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
