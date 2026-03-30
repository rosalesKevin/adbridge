export async function renameSingleExplorerSelection({
  selectedDeviceId,
  explorerPath,
  selectedItems,
  promptForName,
  renameEntry,
  refresh,
  log,
  setBusy
}) {
  if (!selectedDeviceId) {
    log('ERROR: No device selected.');
    return false;
  }

  if (!Array.isArray(selectedItems) || selectedItems.length !== 1) {
    log('ERROR: Select exactly one file or folder to rename.');
    return false;
  }

  const selected = selectedItems[0];
  const newName = await promptForName(selected.name);
  if (!newName || newName === selected.name) {
    return false;
  }

  const remotePath = `${explorerPath}${selected.name}`;
  log(`Renaming ${selectedDeviceId}:${remotePath} -> ${newName}...`);
  setBusy(true);

  try {
    const result = await renameEntry(selectedDeviceId, remotePath, newName);
    if (!result.success) {
      log(`Rename FAILED: ${result.error}`);
      return false;
    }

    log(`Renamed: ${selected.name} -> ${newName}`);
    await refresh(explorerPath);
    return true;
  } finally {
    setBusy(false);
  }
}
