import { dom } from './dom.js';
import { prefersReducedMotion } from './utils.js';

const THEME_KEY = 'adbridge-theme';
const SETTINGS_KEY = 'adbridge-settings';

// Everything off/empty = the app's original behavior.
const DEFAULT_SETTINGS = {
  grantOnInstall: false,
  liveAppList: true,
  showHiddenFiles: false,
  mascot: true,
  autoGrantPackages: [],
  mirror: { stayAwake: false, turnScreenOff: false, showTouches: false, alwaysOnTop: false, maxSize: 0, bitRate: 0 },
  downloadFolder: ''
};

const MIRROR_CHECKBOXES = {
  mirrorStayAwakeChk: 'stayAwake',
  mirrorScreenOffChk: 'turnScreenOff',
  mirrorShowTouchesChk: 'showTouches',
  mirrorOnTopChk: 'alwaysOnTop'
};
const MIRROR_SELECTS = { mirrorMaxSizeSelect: 'maxSize', mirrorBitRateSelect: 'bitRate' };

const settings = loadSettings();

function loadSettings() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch {}
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    autoGrantPackages: Array.isArray(saved.autoGrantPackages) ? saved.autoGrantPackages : [],
    mirror: { ...DEFAULT_SETTINGS.mirror, ...saved.mirror }
  };
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

export function getSettings() {
  return settings;
}

export function isAutoGrantPackage(pkg) {
  return settings.autoGrantPackages.includes(pkg);
}

export function setAutoGrantPackage(pkg, enabled) {
  settings.autoGrantPackages = settings.autoGrantPackages.filter((p) => p !== pkg);
  if (enabled) settings.autoGrantPackages.push(pkg);
  saveSettings();
}

export function setShowHiddenFiles(enabled) {
  settings.showHiddenFiles = enabled;
  saveSettings();
}

export function setLiveAppList(enabled) {
  settings.liveAppList = enabled;
  saveSettings();
}

function renderDownloadFolder() {
  dom.downloadFolderLabel.textContent = settings.downloadFolder || 'Ask every time';
  dom.downloadFolderLabel.title = settings.downloadFolder;
  dom.downloadFolderClearBtn.disabled = !settings.downloadFolder;
}

function initPreferenceControls() {
  dom.liveAppListChk.checked = settings.liveAppList; // apps.js handles changes
  dom.mascotChk.checked = settings.mascot; // mascot.js also listens, to hide it right away
  dom.mascotChk.addEventListener('change', () => {
    settings.mascot = dom.mascotChk.checked;
    saveSettings();
  });
  dom.grantOnInstallChk.checked = settings.grantOnInstall;
  dom.grantOnInstallChk.addEventListener('change', () => {
    settings.grantOnInstall = dom.grantOnInstallChk.checked;
    saveSettings();
  });

  for (const [id, key] of Object.entries(MIRROR_CHECKBOXES)) {
    dom[id].checked = settings.mirror[key];
    dom[id].addEventListener('change', () => {
      settings.mirror[key] = dom[id].checked;
      saveSettings();
    });
  }

  for (const [id, key] of Object.entries(MIRROR_SELECTS)) {
    dom[id].value = String(settings.mirror[key]);
    dom[id].addEventListener('change', () => {
      settings.mirror[key] = Number(dom[id].value);
      saveSettings();
    });
  }

  renderDownloadFolder();
  dom.downloadFolderChooseBtn.addEventListener('click', async () => {
    const picked = await window.dialogs.pickDirectory();
    if (!picked.success || !picked.data) return;
    settings.downloadFolder = picked.data;
    saveSettings();
    renderDownloadFolder();
  });
  dom.downloadFolderClearBtn.addEventListener('click', () => {
    settings.downloadFolder = '';
    saveSettings();
    renderDownloadFolder();
  });
}

function showTheme(theme) {
  document.documentElement.dataset.theme = theme;
  dom.themeDarkBtn.classList.toggle('active', theme === 'dark');
  dom.themeLightBtn.classList.toggle('active', theme === 'light');
}

function setTheme(theme, fromButton) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
  if (document.documentElement.dataset.theme === theme || prefersReducedMotion()) {
    showTheme(theme);
    return;
  }

  const box = fromButton.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const transition = document.startViewTransition(() => showTheme(theme));
  transition.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 450, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' }
    );
  }).catch(() => {}); // a quick second switch skips this one; the theme is still applied
}

function openSettings() {
  dom.settingsOverlay.classList.add('open');
  dom.settingsOverlay.setAttribute('aria-hidden', 'false');
  dom.settingsCloseBtn.focus();
}

function closeSettings() {
  dom.settingsOverlay.classList.remove('open');
  dom.settingsOverlay.setAttribute('aria-hidden', 'true');
  dom.settingsBtn.focus();
}

export function initSettings() {
  // theme-init.js already applied a saved light theme; just sync the buttons.
  showTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  initPreferenceControls();

  dom.settingsBtn.addEventListener('click', openSettings);
  dom.settingsCloseBtn.addEventListener('click', closeSettings);
  dom.themeDarkBtn.addEventListener('click', () => setTheme('dark', dom.themeDarkBtn));
  dom.themeLightBtn.addEventListener('click', () => setTheme('light', dom.themeLightBtn));

  dom.settingsOverlay.addEventListener('click', (event) => {
    if (event.target === dom.settingsOverlay) closeSettings();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dom.settingsOverlay.classList.contains('open')) closeSettings();
  });
}
