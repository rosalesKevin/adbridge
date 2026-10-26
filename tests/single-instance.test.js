'use strict';

const assert = require('node:assert/strict');

const { enforceSingleInstance } = require('../src/main/single-instance');

function fakeApp(gotLock) {
  const app = { quitCalls: 0, handlers: {} };
  app.requestSingleInstanceLock = () => gotLock;
  app.quit = () => { app.quitCalls += 1; };
  app.on = (event, fn) => { app.handlers[event] = fn; };
  return app;
}

function fakeWindow(minimized) {
  const win = { calls: [] };
  win.isMinimized = () => minimized;
  win.restore = () => win.calls.push('restore');
  win.focus = () => win.calls.push('focus');
  return win;
}

{
  const app = fakeApp(false);
  assert.equal(enforceSingleInstance(app, () => null), false, 'tells a second launch not to start');
  assert.equal(app.quitCalls, 1, 'quits the second launch');
  assert.equal(app.handlers['second-instance'], undefined, 'the duplicate does not listen for launches');
}

{
  const app = fakeApp(true);
  const win = fakeWindow(true);
  assert.equal(enforceSingleInstance(app, () => win), true, 'lets the first launch start');
  assert.equal(app.quitCalls, 0, 'does not quit the first launch');

  app.handlers['second-instance']();
  assert.deepEqual(win.calls, ['restore', 'focus'], 'restores and focuses the open window on a second launch');
}

{
  const app = fakeApp(true);
  const win = fakeWindow(false);
  enforceSingleInstance(app, () => win);
  app.handlers['second-instance']();
  assert.deepEqual(win.calls, ['focus'], 'only focuses a window that is not minimized');
}

{
  const app = fakeApp(true);
  enforceSingleInstance(app, () => undefined);
  assert.doesNotThrow(() => app.handlers['second-instance'](), 'ignores a second launch before the window exists');
}

console.log('All tests passed.');
