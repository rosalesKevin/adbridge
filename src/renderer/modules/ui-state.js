import { dom } from './dom.js';
import { state } from './state.js';
import { getExplorerActionState } from './explorer-action-state.mjs';

export function setBusy(isBusy) {
  state.busy = isBusy;
  dom.refreshDevicesBtn.disabled = isBusy;
  dom.browseBtn.disabled = isBusy;
  dom.installBtn.disabled = isBusy;
  dom.appsRefreshBtn.disabled = isBusy;
  dom.uninstallBtn.disabled = isBusy || !state.selectedPackage;
  dom.clearDataBtn.disabled = isBusy || !state.selectedPackage;
  dom.grantPermsBtn.disabled = isBusy || !state.selectedPackage;
  updateExplorerActionButtons();
  dom.explorerUpBtn.disabled = isBusy;
  dom.explorerRefreshBtn.disabled = isBusy;
}

export function updateExplorerActionButtons() {
  const actionState = getExplorerActionState({
    busy: state.busy,
    hasDevice: Boolean(state.selectedDeviceId),
    selectedCount: state.explorerSelectedItems.length
  });
  dom.explorerPushBtn.disabled = actionState.pushDisabled;
  dom.explorerPushFolderBtn.disabled = actionState.pushFolderDisabled;
  dom.explorerPullBtn.disabled = actionState.pullDisabled;
  dom.explorerRenameBtn.disabled = actionState.renameDisabled;
  dom.explorerDeleteBtn.disabled = actionState.deleteDisabled;
  dom.explorerCopyBtn.disabled = actionState.pullDisabled;
  dom.explorerCutBtn.disabled = actionState.pullDisabled;
  dom.explorerPasteBtn.disabled = actionState.pushDisabled;
}

export function updateAppCount(filtered, total) {
  dom.appCount.textContent = `${filtered} / ${total} apps`;
}
