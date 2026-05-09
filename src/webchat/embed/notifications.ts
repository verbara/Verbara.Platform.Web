let originalTitle = '';
let flashInterval: ReturnType<typeof setInterval> | null = null;
let unreadCount = 0;

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
}

let audioCtx: AudioContext | null = null;
let soundEnabled = false;

export function setSoundEnabled(enabled: boolean) {
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
