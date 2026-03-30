import { dom } from './dom.js';
import { state } from './state.js';
import { getExplorerActionState } from './explorer-action-state.mjs';

export function setBusy(isBusy) {
  state.busy = isBusy;
  dom.refreshDevicesBtn.disabled = isBusy;
  dom.browseBtn.disabled = isBusy;
  dom.installBtn.disabled = isBusy || !state.selectedApkPath;
  dom.uninstallBtn.disabled = isBusy || !state.selectedPackage;
  dom.clearDataBtn.disabled = isBusy || !state.selectedPackage;
  const explorerActionState = getExplorerActionState({
    busy: isBusy,
    hasDevice: Boolean(state.selectedDeviceId),
    selectedCount: state.explorerSelectedItems.length
  });
  dom.explorerPushBtn.disabled = explorerActionState.pushDisabled;
  dom.explorerPushFolderBtn.disabled = explorerActionState.pushFolderDisabled;
  dom.explorerPullBtn.disabled = explorerActionState.pullDisabled;
  dom.explorerRenameBtn.disabled = explorerActionState.renameDisabled;
  dom.explorerDeleteBtn.disabled = explorerActionState.deleteDisabled;
  dom.explorerUpBtn.disabled = isBusy;
  dom.explorerRefreshBtn.disabled = isBusy;
}

export function updateAppCount(filtered, total) {
  dom.appCount.textContent = `${filtered} / ${total} apps`;
}
