import { dom } from './dom.js';

// ── State ─────────────────────────────────────────────────────────────────────

/** Session-level dismissed flag — set when user clicks Later or Dismiss. */
let _dismissed = false;

// ── Banner state helpers ──────────────────────────────────────────────────────

function showState(activeId) {
  const states = ['updateBannerAvailable'];
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

// ── Init ──────────────────────────────────────────────────────────────────────

export function initUpdater() {
  window.updater.onUpdateAvailable(onUpdateAvailable);
  dom.updateOpenPageBtn.addEventListener('click', () => {
    window.updater.openReleasePage();
  });

  dom.updateLaterBtn.addEventListener('click', () => {
    _dismissed = true;
    hideBanner();
  });

  dom.updateDismissBtn.addEventListener('click', () => {
    _dismissed = true;
    hideBanner();
  });
}
