let liveRegion: HTMLDivElement | null = null;

export function ensureLiveRegion() {
  if (liveRegion) return liveRegion;
  liveRegion = document.createElement('div');
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.style.position = 'absolute';
  liveRegion.style.left = '-9999px';
  liveRegion.style.height = '1px';
  liveRegion.style.width = '1px';
  liveRegion.style.overflow = 'hidden';
  document.body.appendChild(liveRegion);
  return liveRegion;
}

export function announce(message: string) {
  const region = ensureLiveRegion();
  region.textContent = '';
  setTimeout(() => {
    region.textContent = message;
  }, 50);
}

export function setupKeyboardShortcuts(onClose: () => void) {
  function handler(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}
