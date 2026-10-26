// Loaded synchronously in <head> so a saved light theme is applied before first paint (no dark flash).
try {
  if (localStorage.getItem('adbridge-theme') === 'light') document.documentElement.dataset.theme = 'light';
} catch {}
