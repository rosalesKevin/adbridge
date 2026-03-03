import { dom } from './dom.js';
import { state } from './state.js';
import { appendLog } from './logger.js';

const MAX_LINES = 10000;

let unsubscribeData = null;

// ── App Dropdown ──

/**
 * Repopulate the app selector from state.allPackages.
 * Call this after packages are loaded or when the logcat tab is shown.
 */
export function refreshLogcatAppList() {
  const select = dom.logcatAppSelect;
  const currentVal = select.value;

  select.innerHTML = '<option value="">Select app...</option>';

  for (const pkg of state.allPackages) {
    const opt = document.createElement('option');
    opt.value = pkg;
    opt.textContent = pkg;
    select.appendChild(opt);
  }

  // Restore previous selection if still in the list
  if (currentVal && state.allPackages.includes(currentVal)) {
    select.value = currentVal;
  }
}

// ── Line Rendering ──

/**
 * Extract log level from a brief-format logcat line: "Level/Tag(PID): Message"
 * @param {string} line
 * @returns {string|null} V, D, I, W, E, F, or null
 */
function parseLevel(line) {
  const m = line.match(/^([VDIWEF])\//);
  return m ? m[1] : null;
}

function appendLine(line) {
  const level = parseLevel(line) || 'unknown';
  const span = document.createElement('span');
  span.className = `logcat-line logcat-level-${level}`;
  span.textContent = line;
  dom.logcatOutput.appendChild(span);

  state.logcatLines.push(line);

  // Drop oldest line when cap is reached
  if (state.logcatLines.length > MAX_LINES) {
    state.logcatLines.shift();
    dom.logcatOutput.removeChild(dom.logcatOutput.firstChild);
  }

  // Auto-scroll to bottom
  dom.logcatOutput.scrollTop = dom.logcatOutput.scrollHeight;
}

// ── Start / Stop ──

function setRunning(running) {
  state.logcatRunning = running;
  dom.logcatStartBtn.textContent = running ? '■  Stop' : '▶  Start';
  dom.logcatStartBtn.classList.toggle('btn-danger', running);
  dom.logcatStartBtn.classList.toggle('btn-success', !running);
}

function getCurrentFilters() {
  const tags = dom.logcatTagInput.value.trim();
  const level = dom.logcatLevelSelect.value;
  const levelText = dom.logcatLevelSelect.options[dom.logcatLevelSelect.selectedIndex].text;
  return { tags, level, levelText };
}

async function startLogcat() {
  const deviceId = state.selectedDeviceId;
  if (!deviceId) {
    appendLog('Logcat: no device selected.');
    return;
  }

  const packageName = dom.logcatAppSelect.value;
  if (!packageName) {
    appendLog('Logcat: no app selected.');
    return;
  }

  const { tags, level, levelText } = getCurrentFilters();
  const tagDisplay = tags ? ` tags=[${tags}]` : '';
  appendLog(`Logcat: starting for ${packageName} [level=${levelText}${tagDisplay}]`);

  unsubscribeData = window.logcat.onData((line) => appendLine(line));

  const result = await window.logcat.start(deviceId, packageName, tags, level);

  if (!result.success) {
    appendLog(`Logcat: ${result.error}`);
    if (unsubscribeData) { unsubscribeData(); unsubscribeData = null; }
    return;
  }

  setRunning(true);
}

async function stopLogcat(silent = false) {
  if (unsubscribeData) { unsubscribeData(); unsubscribeData = null; }

  const deviceId = state.selectedDeviceId;
  if (!deviceId) { setRunning(false); return; }

  const result = await window.logcat.stop(deviceId);
  if (!silent) {
    if (result.success) {
      appendLog('Logcat: stopped.');
    } else {
      appendLog(`Logcat stop: ${result.error}`);
    }
  }

  setRunning(false);
}

/**
 * Restart logcat with current filter values. Called when level or tags change
 * while a stream is already running.
 */
async function restartLogcat() {
  if (!state.logcatRunning) return;
  appendLog('Logcat: restarting with new filters...');
  await stopLogcat(true); // silent — no "stopped" log line
  await startLogcat();
}

/**
 * Stop logcat if currently running. Called when device selection changes.
 */
export async function stopLogcatIfRunning() {
  if (state.logcatRunning) {
    await stopLogcat();
  }
}

// ── Clear ──

export function clearLogcat() {
  dom.logcatOutput.innerHTML = '';
  state.logcatLines.length = 0;
}

// ── Init ──

export function initLogcat() {
  dom.logcatStartBtn.addEventListener('click', async () => {
    if (state.logcatRunning) {
      await stopLogcat();
    } else {
      await startLogcat();
    }
  });

  dom.logcatClearBtn.addEventListener('click', () => clearLogcat());

  // Restart stream when level or tags change while running
  dom.logcatLevelSelect.addEventListener('change', () => void restartLogcat());
  dom.logcatTagInput.addEventListener('change', () => void restartLogcat());

  dom.logcatExportBtn.addEventListener('click', async () => {
    if (state.logcatLines.length === 0) {
      appendLog('Logcat: nothing to export.');
      return;
    }

    const content = state.logcatLines.join('\n');
    const now = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const defaultName = `logcat-${now}.log`;

    const result = await window.logcat.saveFile(content, defaultName);
    if (result.success && result.data) {
      appendLog(`Logcat: exported to ${result.data}`);
    } else if (!result.success) {
      appendLog(`Logcat export failed: ${result.error}`);
    }
  });
}
