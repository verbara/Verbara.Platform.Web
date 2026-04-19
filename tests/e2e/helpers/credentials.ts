export const API_BASE = 'http://localhost:5000';

export const PLATFORM_ADMIN = {
  tenantId: 'platform',
  email: 'platform@admin.local',
  password: 'PlatformAdmin2026!',
} as const;

export const DEMO_ADMIN = {
  tenantId: 'demo',
  email: 'admin@demo.local',
  password: 'DemoAdmin2026!',
} as const;

export const DEMO_SUPERVISOR = {
  tenantId: 'demo',
  email: 'supervisor@demo.local',
  password: 'DemoSupervisor2026!',
} as const;

export const DEMO_AGENT = {
  tenantId: 'demo',
  email: 'demo.agent@demo.local',
  password: 'DemoAgent2026!',
} as const;
