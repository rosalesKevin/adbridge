export function diffPackages(oldList, newList) {
  const oldSet = new Set(oldList);
  const newSet = new Set(newList);
  return {
    added: newList.filter((pkg) => !oldSet.has(pkg)),
    removed: oldList.filter((pkg) => !newSet.has(pkg))
  };
}
