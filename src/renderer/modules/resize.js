const MIN_LOG_HEIGHT = 38;   // just the header row
const MAX_LOG_HEIGHT = 500;

export function initResize() {
  const handle = document.getElementById('logResizeHandle');
  const logPanel = document.querySelector('.log-panel');

  handle.addEventListener('mousedown', (e) => {
    const startY = e.clientY;
    const startHeight = logPanel.offsetHeight;

    handle.classList.add('dragging');

    function onMove(e) {
      const delta = startY - e.clientY;
      const newHeight = Math.min(Math.max(startHeight + delta, MIN_LOG_HEIGHT), MAX_LOG_HEIGHT);
      logPanel.style.height = `${newHeight}px`;
    }

    function onUp() {
      handle.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  });
}
