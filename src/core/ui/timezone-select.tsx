import { useEffect, useMemo, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface TimezoneSelectProps {
  readonly value: string;
  readonly onChange: (zone: string) => void;
  readonly autoDetect?: boolean;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly id?: string;
  readonly 'aria-label'?: string;
  readonly 'aria-invalid'?: boolean;
  readonly 'aria-describedby'?: string;
}

const REGIONS = [
  'Africa',
  'America',
  'Antarctica',
  'Arctic',
  'Asia',
  'Atlantic',
  'Australia',
  'Europe',
  'Indian',
  'Pacific',
] as const;

interface ZoneGroup {
  region: string;
  zones: string[];
}

interface IntlWithSupportedValues {
  supportedValuesOf?: (key: string) => string[];
}

function getAvailableZones(): string[] {
  const intlExt = Intl as unknown as IntlWithSupportedValues;
  if (typeof intlExt.supportedValuesOf === 'function') {
    return intlExt.supportedValuesOf('timeZone');
  }
  return ['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo'];
}

function groupByRegion(zones: string[]): ZoneGroup[] {
  const map = new Map<string, string[]>();
  for (const z of zones) {
    const region = z.includes('/') ? (z.split('/')[0] ?? 'UTC') : 'UTC';
    if (!map.has(region)) map.set(region, []);
    map.get(region)?.push(z);
  }
  const groups: ZoneGroup[] = [];
  for (const region of REGIONS) {
    const zs = map.get(region);
    if (zs && zs.length > 0) groups.push({ region, zones: [...zs].sort() });
  }
  if (map.has('UTC')) groups.push({ region: 'UTC', zones: ['UTC'] });
  return groups;
}

function detectBrowserZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function TimezoneSelect({
  value,
  onChange,
  autoDetect = false,
  disabled = false,
  className,
  id,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: TimezoneSelectProps) {
  const { t } = useTranslation('common');
  const groups = useMemo(() => groupByRegion(getAvailableZones()), []);

  useEffect(() => {
    if (autoDetect && !value) {
      onChange(detectBrowserZone());
    }
  }, [autoDetect, value, onChange]);

  function handleChange(e: ChangeEvent<HTMLSelectElement>) {
    onChange(e.target.value);
  }

  return (
    <select
      id={id}
      aria-label={ariaLabel ?? t('timezone.search')}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
      value={value}
      onChange={handleChange}
      disabled={disabled}
      className={cn(
        'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
    >
      {!value && (
        <option value="" disabled>
          {t('timezone.search')}
        </option>
      )}
      {groups.map((g) => (
        <optgroup key={g.region} label={t(`timezone.region.${g.region}`)}>
          {g.zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
