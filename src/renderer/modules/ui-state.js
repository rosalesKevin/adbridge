import { dom } from './dom.js';
import { state } from './state.js';

export function setBusy(isBusy) {
  state.busy = isBusy;
  dom.refreshDevicesBtn.disabled = isBusy;
  dom.browseBtn.disabled = isBusy;
  dom.installBtn.disabled = isBusy || !state.selectedApkPath;
  dom.uninstallBtn.disabled = isBusy || !state.selectedPackage;
  dom.clearDataBtn.disabled = isBusy || !state.selectedPackage;
  dom.explorerPushBtn.disabled = isBusy || !state.selectedDeviceId;
  dom.explorerPushFolderBtn.disabled = isBusy || !state.selectedDeviceId;
  dom.explorerPullBtn.disabled = isBusy || !state.explorerSelected;
  dom.explorerUpBtn.disabled = isBusy;
  dom.explorerRefreshBtn.disabled = isBusy;
  dom.explorerGoBtn.disabled = isBusy;
}

export function updateAppCount(filtered, total) {
  dom.appCount.textContent = `${filtered} / ${total} apps`;
}
