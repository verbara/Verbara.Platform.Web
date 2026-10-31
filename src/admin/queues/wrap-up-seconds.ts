// The range the Platform API accepts for wrapUp.defaultWrapUpSeconds; outside it the API answers 400.
export const WRAP_UP_MAX_SECONDS = 600;
const WRAP_UP_FALLBACK_SECONDS = 30;

/** An empty field is allowed and takes the fallback; anything else is a whole number in range. */
export function isWrapUpSecondsAccepted(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === '' || (/^\d+$/.test(trimmed) && Number(trimmed) <= WRAP_UP_MAX_SECONDS);
}

export function wrapUpSecondsToApi(value: string): number {
  const trimmed = value.trim();
  return trimmed === '' ? WRAP_UP_FALLBACK_SECONDS : Number(trimmed);
}
