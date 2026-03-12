/**
 * ADBridge - Renderer entrypoint
 * Runs as a browser ES module and uses the preload APIs on window.*.
 */

import { dom } from './modules/dom.js';
import { state } from './modules/state.js';
import { appendLog, initLogger } from './modules/logger.js';
import { initApps, loadPackages, clearAppList } from './modules/apps.js';
import { initExplorer, explorerNavigate, clearExplorer, handleDeviceSelectedForExplorer } from './modules/explorer.js';
import { initDevices, checkAdbStatus, refreshDevices } from './modules/devices.js';
import { initTabs } from './modules/tabs.js';
import { initLogcat, refreshLogcatAppList, stopLogcatIfRunning, clearLogcat } from './modules/logcat.js';
import { loadDeviceInfo, clearDeviceInfo } from './modules/device-info.js';
import { initResize } from './modules/resize.js';

async function onDeviceSelected(device) {
  void stopLogcatIfRunning();
  void loadDeviceInfo(device.id);
  await loadPackages();
  refreshLogcatAppList();
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

function onLogcatTabShown() {
  refreshLogcatAppList();
}

function initEvents() {
  initLogger();
  initResize();
  initTabs({ onExplorerTabShown, onLogcatTabShown });
  initApps();
  initExplorer();
  initLogcat();
  initDevices({ onNoDevices, onDeviceSelected });
}

async function init() {
  appendLog('ADBridge starting...');
  initEvents();
  await checkAdbStatus();
  await refreshDevices({ onNoDevices, onDeviceSelected });
}

void init();
