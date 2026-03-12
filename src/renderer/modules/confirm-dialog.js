import { dom } from './dom.js';

let isInitialized = false;
let isPromptMode = false;
let pendingResolve = null;
let previouslyFocusedElement = null;

function closeDialog(confirmed) {
  if (!pendingResolve) return;

  const resolve = pendingResolve;
  pendingResolve = null;

  const wasPrompt = isPromptMode;
  const inputValue = wasPrompt ? dom.confirmInput.value.trim() : null;

  dom.confirmOverlay.classList.remove('open', 'prompt-mode');
  dom.confirmOverlay.setAttribute('aria-hidden', 'true');
  dom.confirmOkBtn.classList.remove('btn-danger', 'btn-primary');
  dom.confirmOkBtn.classList.add('btn-danger');
  dom.confirmInput.value = '';
  dom.confirmInput.type = 'text';
  isPromptMode = false;

  if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
    previouslyFocusedElement.focus();
  }

  if (wasPrompt) {
    resolve(confirmed ? inputValue : null);
  } else {
    resolve(Boolean(confirmed));
  }
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

  dom.confirmInput.addEventListener('keydown', (event) => {
    if (!pendingResolve) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      closeDialog(true);
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

/**
 * Show the confirm dialog with a text input field.
 * Resolves with the trimmed input string, or null if cancelled.
 */
export function showPromptDialog({
  title,
  message = '',
  placeholder = '',
  inputType = 'text',
  confirmText = 'Create',
  cancelText = 'Cancel'
}) {
  bindEvents();

  if (pendingResolve) {
    return Promise.resolve(null);
  }

  isPromptMode = true;
  dom.confirmTitle.textContent = title ?? 'Input';
  dom.confirmMessage.textContent = message;
  dom.confirmInput.type = inputType;
  dom.confirmInput.placeholder = placeholder;
  dom.confirmInput.value = '';
  dom.confirmCancelBtn.textContent = cancelText;
  dom.confirmOkBtn.textContent = confirmText;
  dom.confirmOkBtn.classList.remove('btn-danger', 'btn-primary');
  dom.confirmOkBtn.classList.add('btn-primary');

  previouslyFocusedElement = document.activeElement;
  dom.confirmOverlay.classList.add('open', 'prompt-mode');
  dom.confirmOverlay.setAttribute('aria-hidden', 'false');

  return new Promise((resolve) => {
    pendingResolve = resolve;
    dom.confirmInput.focus();
  });
}
