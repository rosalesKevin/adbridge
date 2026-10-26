import { dom } from './dom.js';

// Pane id → its sidebar nav button id
const TABS = { tabApps: 'tabBtnApps', tabExplorer: 'tabBtnExplorer', tabLogcat: 'tabBtnLogcat' };

function showTab(id, callbacks) {
  for (const [pane, button] of Object.entries(TABS)) {
    dom[pane].classList.toggle('active', pane === id);
    dom[button].classList.toggle('active', pane === id);
  }
  if (id === 'tabExplorer') callbacks.onExplorerTabShown();
  if (id === 'tabLogcat') callbacks.onLogcatTabShown();
}

export function initTabs(callbacks) {
  for (const [pane, button] of Object.entries(TABS)) {
    dom[button].addEventListener('click', () => showTab(pane, callbacks));
  }
}
