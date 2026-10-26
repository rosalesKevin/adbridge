/**
 * ADBridge - Renderer entrypoint
 * Runs as a browser ES module and uses the preload APIs on window.*.
 */

import { dom } from './modules/dom.js';
import { state } from './modules/state.js';
import { appendLog, initLogger } from './modules/logger.js';
import { initApps, loadPackages, clearAppList, refreshPackagesLive } from './modules/apps.js';
import { initAutoGrant } from './modules/auto-grant.js';
import { initExplorer, explorerNavigate, clearExplorer, handleDeviceSelectedForExplorer } from './modules/explorer.js';
import { initDevices, checkAdbStatus, refreshDevices } from './modules/devices.js';
import { initTabs } from './modules/tabs.js';
import { initLogcat, refreshLogcatAppList, stopLogcatIfRunning, clearLogcat } from './modules/logcat.js';
import { loadDeviceInfo, clearDeviceInfo } from './modules/device-info.js';
import { initResize } from './modules/resize.js';
import { initUpdater } from './modules/updater.js';
import { initSettings } from './modules/settings.js';
import { initMascot } from './modules/mascot.js';

async function initAppVersion() {
  try {
    const result = await window.appInfo.version();
    if (result?.success && result.data?.version) {
      dom.appVersion.textContent = `v${result.data.version}`;
    }
  } catch (error) {
    appendLog(`Failed to load app version: ${error.message}`);
  }
}

async function onDeviceSelected(device) {
  void stopLogcatIfRunning();
  void loadDeviceInfo(device.id);
  await loadPackages();
  handleDeviceSelectedForExplorer();
}

function onNoDevices() {
  clearAppList();
  clearExplorer();
  void stopLogcatIfRunning();
  clearLogcat();
  clearDeviceInfo();
}

function onExplorerTabShown() {
  if (state.selectedDeviceId) {
    void explorerNavigate(state.explorerPath);
  } else {
    dom.explorerList.innerHTML = '<li class="empty-state">Select a device to browse files</li>';
  }
}

function isShown(pane) {
  return pane.classList.contains('active');
}

function refreshVisibleSection() {
  if (!state.selectedDeviceId || state.busy) return;
  if (isShown(dom.tabApps)) void loadPackages();
  else if (isShown(dom.tabExplorer)) void explorerNavigate(state.explorerPath);
}

function initRefreshTriggers() {
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'F5') return;
    event.preventDefault();
    refreshVisibleSection();
  });

  // Catch changes made on the phone or in other tools while ADBridge was in the background.
  // The delay lets an action started from a native file dialog (e.g. Push) mark itself busy first.
  window.addEventListener('focus', () => {
    setTimeout(() => {
      if (isShown(dom.tabApps)) void refreshPackagesLive();
      else if (isShown(dom.tabExplorer) && state.explorerSelectedItems.length === 0) refreshVisibleSection();
    }, 300);
  });
}

function initEvents() {
  initLogger();
  initResize();
  initTabs({ onExplorerTabShown, onLogcatTabShown: refreshLogcatAppList });
  initApps();
  initExplorer();
  initLogcat();
  initDevices({ onNoDevices, onDeviceSelected });
  initUpdater();
  initSettings();
  initMascot();
  initAutoGrant();
  initRefreshTriggers();
}

async function init() {
  appendLog('ADBridge starting...');
  initEvents();
  await initAppVersion();
  await checkAdbStatus();
  await refreshDevices();
}

void init();
