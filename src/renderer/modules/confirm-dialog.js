import { dom } from './dom.js';

let isPromptMode = false;
let pendingResolve = null;
let previouslyFocusedElement = null;

function closeDialog(confirmed) {
  if (!pendingResolve) return;

  const resolve = pendingResolve;
  pendingResolve = null;
  const wasPrompt = isPromptMode;
  isPromptMode = false;
  const inputValue = dom.confirmInput.value.trim();

  dom.confirmOverlay.classList.remove('open', 'prompt-mode', 'info-mode');
  dom.confirmOverlay.setAttribute('aria-hidden', 'true');
  dom.confirmInput.value = ''; // don't leave a typed keystore password in the DOM
  previouslyFocusedElement?.focus?.();

  resolve(wasPrompt ? (confirmed ? inputValue : null) : Boolean(confirmed));
}

function openDialog({ title, message, confirmText, primary, promptMode, focusTarget, infoMode = false }) {
  dom.confirmTitle.textContent = title;
  dom.confirmMessage.textContent = message;
  dom.confirmOkBtn.textContent = confirmText;
  dom.confirmOkBtn.classList.toggle('btn-primary', primary);
  dom.confirmOkBtn.classList.toggle('btn-danger', !primary);

  isPromptMode = promptMode;
  previouslyFocusedElement = document.activeElement;
  dom.confirmOverlay.classList.add('open');
  dom.confirmOverlay.classList.toggle('prompt-mode', promptMode);
  dom.confirmOverlay.classList.toggle('info-mode', infoMode);
  dom.confirmOverlay.setAttribute('aria-hidden', 'false');

  return new Promise((resolve) => {
    pendingResolve = resolve;
    focusTarget.focus();
  });
}

dom.confirmCancelBtn.addEventListener('click', () => closeDialog(false));
dom.confirmOkBtn.addEventListener('click', () => closeDialog(true));
dom.confirmOverlay.addEventListener('click', (event) => {
  if (event.target === dom.confirmOverlay) closeDialog(false);
});
dom.confirmInput.addEventListener('keydown', (event) => {
  if (pendingResolve && event.key === 'Enter') {
    event.preventDefault();
    closeDialog(true);
  }
});
document.addEventListener('keydown', (event) => {
  if (pendingResolve && event.key === 'Escape') {
    event.preventDefault();
    closeDialog(false);
  }
});

export function showConfirmDialog({ title, message, confirmText = 'Confirm', confirmStyle = 'danger' }) {
  if (pendingResolve) return Promise.resolve(false);

  return openDialog({
    title: title ?? 'Confirm action',
    message: message ?? '',
    confirmText,
    primary: confirmStyle === 'primary',
    promptMode: false,
    focusTarget: dom.confirmOkBtn
  });
}

/** Read-only message with a single Close button (no Cancel). */
export function showInfoDialog({ title, message }) {
  if (pendingResolve) return Promise.resolve(false);
  return openDialog({ title, message, confirmText: 'Close', primary: true, promptMode: false, focusTarget: dom.confirmOkBtn, infoMode: true });
}

/**
 * Show the confirm dialog with a text input field.
 * Resolves with the trimmed input string, or null if cancelled.
 */
export function showPromptDialog({ title, message = '', placeholder = '', inputType = 'text', confirmText = 'Create' }) {
  if (pendingResolve) return Promise.resolve(null);

  dom.confirmInput.type = inputType;
  dom.confirmInput.placeholder = placeholder;
  dom.confirmInput.value = '';
  return openDialog({ title: title ?? 'Input', message, confirmText, primary: true, promptMode: true, focusTarget: dom.confirmInput });
}
