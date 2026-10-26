import { dom } from './dom.js';

const MIN_LOG_HEIGHT = 38;   // just the header row
const MAX_LOG_HEIGHT = 500;
const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 420;

/** Calls onMove(dx, dy) — distance from the mousedown point — while the handle is dragged. */
function makeDraggable(handle, onStart, onMove) {
  handle.addEventListener('mousedown', (e) => {
    const startX = e.clientX;
    const startY = e.clientY;
    onStart();
    handle.classList.add('dragging');

    function move(e) {
      onMove(e.clientX - startX, e.clientY - startY);
    }

    function up() {
      handle.classList.remove('dragging');
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    }

    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    e.preventDefault();
  });
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function initResize() {
  let startHeight = 0;
  makeDraggable(
    dom.logResizeHandle,
    () => { startHeight = dom.logPanel.offsetHeight; },
    (_dx, dy) => { dom.logPanel.style.height = `${clamp(startHeight - dy, MIN_LOG_HEIGHT, MAX_LOG_HEIGHT)}px`; }
  );

  const sidebar = document.querySelector('.sidebar');
  let startWidth = 0;
  makeDraggable(
    document.getElementById('sidebarResizeHandle'),
    () => { startWidth = sidebar.offsetWidth; },
    (dx) => { sidebar.style.width = `${clamp(startWidth + dx, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH)}px`; }
  );
}
