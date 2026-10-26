import { dom } from './dom.js';

export function appendLog(message) {
  const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
  dom.logOutput.textContent += `[${time}] ${message}\n`;
  dom.logOutput.scrollTop = dom.logOutput.scrollHeight;
  dom.logLastLine.textContent = message;
}

function setLogCollapsed(collapsed) {
  dom.logPanel.classList.toggle('collapsed', collapsed);
  dom.logResizeHandle.classList.toggle('hidden', collapsed);
  dom.logToggleBtn.textContent = collapsed ? 'Log' : '—';
  dom.logToggleBtn.title = collapsed ? 'Show log' : 'Minimize log';
  dom.logToggleBtn.setAttribute('aria-label', dom.logToggleBtn.title);
  dom.logToggleBtn.setAttribute('aria-expanded', String(!collapsed));
  // Hidden elements lose scroll position; jump to newest lines on expand.
  if (!collapsed) dom.logOutput.scrollTop = dom.logOutput.scrollHeight;
}

/** Opens the log drawer, for actions whose result is printed to the log. */
export function showLog() {
  setLogCollapsed(false);
}

export function initLogger() {
  dom.clearLogBtn.addEventListener('click', () => {
    dom.logOutput.textContent = '';
  });
  dom.logToggleBtn.addEventListener('click', () => {
    setLogCollapsed(!dom.logPanel.classList.contains('collapsed'));
  });
}
