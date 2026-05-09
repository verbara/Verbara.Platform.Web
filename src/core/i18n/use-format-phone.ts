import { useEffect, useRef, useState } from 'react';

type PhoneEngine = typeof import('./phone-engine');

export interface PhoneParseResult {
  country?: string;
  national: string;
  e164: string;
}

export interface UseFormatPhoneResult {
  /** Best-effort format. Returns `raw` if parse fails or engine not yet loaded. */
  formatPhone: (raw: string, country?: string) => string;
  /** Returns null if unparseable or engine not loaded. */
  parsePhone: (raw: string) => PhoneParseResult | null;
  /** Validates against country if provided, else permissive. False if engine not loaded. */
  isValidPhone: (raw: string, country?: string) => boolean;
  /** Default country for parsing. Currently hardcoded to 'US' (follow-up: read from tenant). */
  getDefaultCountry: () => string;
}

let cachedEngine: PhoneEngine | null = null;

async function loadEngine(): Promise<PhoneEngine> {
  if (cachedEngine) return cachedEngine;
  cachedEngine = await import('./phone-engine');
  return cachedEngine;
}

export function useFormatPhone(): UseFormatPhoneResult {
  const [engine, setEngine] = useState<PhoneEngine | null>(cachedEngine);
  const engineRef = useRef<PhoneEngine | null>(cachedEngine);

  useEffect(() => {
    let cancelled = false;
    if (engineRef.current) return;
    void loadEngine().then((mod) => {
      if (cancelled) return;
      engineRef.current = mod;
      setEngine(mod);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const getDefaultCountry = () => 'US';

  const formatPhone = (raw: string, country?: string): string => {
    const mod = engineRef.current ?? engine;
    if (!mod) return raw;
    try {
      const parsed = mod.parsePhoneNumber(raw, (country ?? getDefaultCountry()) as never);
      return parsed.formatInternational();
    } catch {
      return raw;
    }
  };

  const parsePhone = (raw: string): PhoneParseResult | null => {
    const mod = engineRef.current ?? engine;
    if (!mod) return null;
    try {
      const parsed = mod.parsePhoneNumber(raw, getDefaultCountry() as never);
      return {
        country: parsed.country,
        national: parsed.formatNational(),
        e164: parsed.format('E.164'),
      };
    } catch {
      return null;
    }
  };

  const isValidPhone = (raw: string, country?: string): boolean => {
    const mod = engineRef.current ?? engine;
    if (!mod) return false;
    try {
      return mod.isValidPhoneNumber(raw, (country ?? getDefaultCountry()) as never);
    } catch {
      return false;
    }
  };

  return { formatPhone, parsePhone, isValidPhone, getDefaultCountry };
}
