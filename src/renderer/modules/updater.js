import { dom } from './dom.js';

// ── State ─────────────────────────────────────────────────────────────────────

/** Session-level dismissed flag — set when user clicks Later or Dismiss. */
let _dismissed = false;

// ── Banner state helpers ──────────────────────────────────────────────────────

function showState(activeId) {
  const states = ['updateBannerAvailable', 'updateBannerDownloading', 'updateBannerError'];
  for (const id of states) {
    dom[id].classList.toggle('hidden', id !== activeId);
  }
  dom.updateBanner.classList.remove('hidden');
}

function hideBanner() {
  dom.updateBanner.classList.add('hidden');
}

// ── Event handlers ────────────────────────────────────────────────────────────

function onUpdateAvailable({ version }) {
  if (_dismissed) return;
  dom.updateBannerMsg.textContent = `ADBridge v${version} is available`;
  showState('updateBannerAvailable');
}

function onProgress({ status, percent }) {
  if (status === 'downloading') {
    showState('updateBannerDownloading');
    if (percent !== undefined) {
      dom.updateProgressFill.style.width = `${percent}%`;
      dom.updateProgressPct.textContent = `${percent}%`;
      dom.updateProgressFill.style.opacity = '';
    } else {
      dom.updateProgressFill.style.width = '100%';
      dom.updateProgressPct.textContent = '';
      dom.updateProgressFill.style.opacity = '0.5';
    }
  } else if (status === 'error') {
    showState('updateBannerError');
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initUpdater() {
  window.updater.onUpdateAvailable(onUpdateAvailable);
  window.updater.onProgress(onProgress);

  dom.updateNowBtn.addEventListener('click', () => {
    window.updater.downloadAndInstall();
  });

  dom.updateLaterBtn.addEventListener('click', () => {
    _dismissed = true;
    hideBanner();
  });

  dom.updateOpenPageBtn.addEventListener('click', () => {
    window.updater.openReleasePage();
  });

  dom.updateDismissBtn.addEventListener('click', () => {
    _dismissed = true;
    hideBanner();
  });
}
