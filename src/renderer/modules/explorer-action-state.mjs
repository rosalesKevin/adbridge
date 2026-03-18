export function getExplorerActionState({ busy, hasDevice, selectedCount }) {
  const canTransferSelection = hasDevice && selectedCount > 0 && !busy;

  return {
    pushDisabled: busy || !hasDevice,
    pushFolderDisabled: busy || !hasDevice,
    pullDisabled: !canTransferSelection,
    deleteDisabled: !canTransferSelection
  };
}
