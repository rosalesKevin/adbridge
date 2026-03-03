import { dom } from './dom.js';

const PANES = ['tabApps', 'tabExplorer', 'tabLogcat'];
const BTN_FOR_PANE = {
  tabApps: 'tabBtnApps',
  tabExplorer: 'tabBtnExplorer',
  tabLogcat: 'tabBtnLogcat'
};

export function showTab(id, callbacks = {}) {
  PANES.forEach((paneId) => dom[paneId].classList.remove('active'));
  PANES.forEach((paneId) => dom[BTN_FOR_PANE[paneId]].classList.remove('active'));

  dom[id].classList.add('active');
  dom[BTN_FOR_PANE[id]].classList.add('active');

  if (id === 'tabExplorer' && typeof callbacks.onExplorerTabShown === 'function') {
    callbacks.onExplorerTabShown();
  }
  if (id === 'tabLogcat' && typeof callbacks.onLogcatTabShown === 'function') {
    callbacks.onLogcatTabShown();
  }
}

export function initTabs(callbacks = {}) {
  dom.tabBtnApps.addEventListener('click', () => showTab('tabApps', callbacks));
  dom.tabBtnExplorer.addEventListener('click', () => showTab('tabExplorer', callbacks));
  dom.tabBtnLogcat.addEventListener('click', () => showTab('tabLogcat', callbacks));
}
