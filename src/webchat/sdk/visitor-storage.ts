export interface VisitorProfile {
  name?: string;
  email?: string;
}

const ID_KEY = (tenantId: string) => `verbara-webchat-visitor:${tenantId}`;
const PROFILE_KEY = (tenantId: string) => `verbara-webchat-profile:${tenantId}`;

export function getOrCreateVisitorId(tenantId: string): string {
  const key = ID_KEY(tenantId);
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function getVisitorProfile(tenantId: string): VisitorProfile | null {
  const raw = localStorage.getItem(PROFILE_KEY(tenantId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VisitorProfile;
  } catch {
    return null;
  }
}

export function setVisitorProfile(tenantId: string, profile: VisitorProfile): void {
  localStorage.setItem(PROFILE_KEY(tenantId), JSON.stringify(profile));
}

export function resetVisitor(tenantId: string): void {
  localStorage.removeItem(ID_KEY(tenantId));
  localStorage.removeItem(PROFILE_KEY(tenantId));
}
