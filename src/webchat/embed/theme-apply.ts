export interface ThemeConfig {
  primaryColor?: string;
  fontFamily?: string;
}

const ALLOWED_COLOR = /^#[0-9a-f]{3,8}$|^rgb/i;

export function applyTheme(theme: ThemeConfig | undefined): void {
  if (!theme) return;
  const root = document.documentElement;
  if (theme.primaryColor && ALLOWED_COLOR.test(theme.primaryColor)) {
    root.style.setProperty('--vw-primary', theme.primaryColor);
  }
  if (theme.fontFamily) {
    const safe = theme.fontFamily.replace(/[;<>"]/g, '');
    root.style.setProperty('--vw-font', safe);
  }
}
