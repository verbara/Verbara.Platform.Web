let originalTitle = '';
let flashInterval: ReturnType<typeof setInterval> | null = null;
let unreadCount = 0;

let originalFavicon: string | null = null;

function ensureFaviconLink(): HTMLLinkElement {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  if (originalFavicon === null) originalFavicon = link.href || '';
  return link;
}

export function setFaviconBadge(count: number): void {
  const link = ensureFaviconLink();
  if (count <= 0) {
    link.href = originalFavicon ?? '';
    return;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(16, 16, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.font = 'bold 16px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(count > 9 ? '9+' : String(count), 16, 17);
  link.href = canvas.toDataURL('image/png');
}

export function setupTitleFlash() {
  originalTitle = document.title || 'Verbara Chat';
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      stopFlash();
    }
  });
}

export function flashUnread(count: number) {
  unreadCount = count;
  if (count === 0) {
    stopFlash();
    return;
  }
  setFaviconBadge(count);
  if (flashInterval) return;
  flashInterval = setInterval(() => {
    document.title =
      document.title === originalTitle
        ? `(${unreadCount}) New message — ${originalTitle}`
        : originalTitle;
  }, 1500);
}

export function stopFlash() {
  if (flashInterval) {
    clearInterval(flashInterval);
    flashInterval = null;
  }
  document.title = originalTitle;
  unreadCount = 0;
  setFaviconBadge(0);
}

let audioCtx: AudioContext | null = null;
let soundEnabled = false;

const SOUND_KEY = 'verbara-webchat-sound';

export function loadSoundPreference(): boolean {
  return localStorage.getItem(SOUND_KEY) === 'on';
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

export function setSoundEnabled(enabled: boolean) {
  localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off');
  soundEnabled = enabled;
  if (enabled && !audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      audioCtx = null;
    }
  }
}

export function playNotificationSound() {
  if (!soundEnabled || !audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  } catch {
    // ignore
  }
}
