import { dom } from './dom.js';

let isInitialized = false;
let pendingResolve = null;
let previouslyFocusedElement = null;

function closeDialog(confirmed) {
  if (!pendingResolve) return;

  const resolve = pendingResolve;
  pendingResolve = null;

  dom.confirmOverlay.classList.remove('open');
  dom.confirmOverlay.setAttribute('aria-hidden', 'true');
  dom.confirmOkBtn.classList.remove('btn-danger', 'btn-primary');
  dom.confirmOkBtn.classList.add('btn-danger');

  if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
    previouslyFocusedElement.focus();
  }

  resolve(Boolean(confirmed));
}

function bindEvents() {
  if (isInitialized) return;
  isInitialized = true;

  dom.confirmCancelBtn.addEventListener('click', () => closeDialog(false));
  dom.confirmOkBtn.addEventListener('click', () => closeDialog(true));

  dom.confirmOverlay.addEventListener('click', (event) => {
    if (event.target === dom.confirmOverlay) {
      closeDialog(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (!pendingResolve) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDialog(false);
    }
  });
}

export function showConfirmDialog({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmStyle = 'danger'
}) {
  bindEvents();

  if (pendingResolve) {
    return Promise.resolve(false);
  }

  dom.confirmTitle.textContent = title ?? 'Confirm action';
  dom.confirmMessage.textContent = message ?? '';
  dom.confirmCancelBtn.textContent = cancelText;
  dom.confirmOkBtn.textContent = confirmText;
  dom.confirmOkBtn.classList.remove('btn-danger', 'btn-primary');
  dom.confirmOkBtn.classList.add(confirmStyle === 'primary' ? 'btn-primary' : 'btn-danger');

  previouslyFocusedElement = document.activeElement;
  dom.confirmOverlay.classList.add('open');
  dom.confirmOverlay.setAttribute('aria-hidden', 'false');

  return new Promise((resolve) => {
    pendingResolve = resolve;
    dom.confirmOkBtn.focus();
  });
}
