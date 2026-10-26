import { dom } from './dom.js';

// Later / Dismiss hide the banner for the rest of the session.
let dismissed = false;

function dismiss() {
  dismissed = true;
  dom.updateBanner.classList.add('hidden');
}

export function initUpdater() {
  window.updater.onUpdateAvailable(({ version }) => {
    if (dismissed) return;
    dom.updateBannerMsg.textContent = `ADBridge v${version} is available`;
    dom.updateBanner.classList.remove('hidden');
  });
  dom.updateOpenPageBtn.addEventListener('click', () => window.updater.openReleasePage());
  dom.updateLaterBtn.addEventListener('click', dismiss);
  dom.updateDismissBtn.addEventListener('click', dismiss);
}
