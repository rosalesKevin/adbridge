import { dom } from './dom.js';

export function appendLog(message) {
  const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
  dom.logOutput.textContent += `[${time}] ${message}\n`;
  dom.logOutput.scrollTop = dom.logOutput.scrollHeight;
}

export function initLogger() {
  dom.clearLogBtn.addEventListener('click', () => {
    dom.logOutput.textContent = '';
  });
}
