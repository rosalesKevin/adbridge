const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });

function compareBy(key, a, b) {
  if (key === 'size') return (a.size ?? 0) - (b.size ?? 0);
  if (key === 'modified') return a.modifiedMs - b.modifiedMs;
  return byName(a, b);
}

/**
 * What the explorer shows for a folder listing: filtered (case-insensitive substring),
 * dotfiles hidden unless showHidden, folders first, then sorted by name / size / modified.
 * sortDir is 1 (ascending) or -1. Entries without a known date always sort last.
 */
export function arrangeEntries(entries, { sortKey, sortDir, filter, showHidden }) {
  const needle = filter.trim().toLowerCase();
  const visible = entries.filter((entry) =>
    (showHidden || !entry.name.startsWith('.')) && (!needle || entry.name.toLowerCase().includes(needle)));

  return visible.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    const key = sortKey === 'size' && a.isDir ? 'name' : sortKey; // a folder's "size" is meaningless
    if (key === 'modified') {
      const aKnown = Number.isFinite(a.modifiedMs);
      const bKnown = Number.isFinite(b.modifiedMs);
      if (aKnown !== bKnown) return aKnown ? -1 : 1;
      if (!aKnown) return byName(a, b);
    }
    return (compareBy(key, a, b) || byName(a, b)) * sortDir;
  });
}
