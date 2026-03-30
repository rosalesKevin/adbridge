'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const Module = require('node:module');

function createStream() {
  const emitter = new EventEmitter();
  emitter.setEncoding = () => {};
  return emitter;
}

function createChildProcess() {
  const child = new EventEmitter();
  child.stdout = createStream();
  child.stderr = createStream();
  child.killCalls = 0;
  child.kill = () => {
    child.killCalls += 1;
    child.emit('close', null);
  };
  return child;
}

function loadRunnerWithStubs(stubs) {
  const runnerPath = require.resolve('../src/main/adb/runner');
  delete require.cache[runnerPath];

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'node:child_process') return stubs.childProcess;
    if (request === './resolver') return stubs.resolver;
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require('../src/main/adb/runner');
  } finally {
    Module._load = originalLoad;
  }
}

(async () => {
  {
    let execCall = null;
    const runner = loadRunnerWithStubs({
      childProcess: {
        execFile(exe, args, options, callback) {
          execCall = { exe, args, options };
          callback(null, ' ok \n', ' warn \n');
        },
        spawn() {
          throw new Error('spawn should not be used in this test');
        }
      },
      resolver: {
        getAdbExe() {
          return 'adb.exe';
        }
      }
    });

    const result = await runner.runAdb(['devices'], 4321);
    assert.deepEqual(result, { stdout: 'ok', stderr: 'warn' }, 'trims stdout and stderr on success');
    assert.equal(execCall.exe, 'adb.exe');
    assert.deepEqual(execCall.args, ['devices']);
    assert.equal(execCall.options.timeout, 4321);
  }

  {
    const runner = loadRunnerWithStubs({
      childProcess: {
        execFile(_exe, _args, _options, callback) {
          const error = new Error('non-zero exit');
          callback(error, ' partial ', ' detail ');
        },
        spawn() {
          throw new Error('spawn should not be used in this test');
        }
      },
      resolver: {
        getAdbExe() {
          return 'adb.exe';
        }
      }
    });

    const result = await runner.runAdb(['shell', 'pm', 'list', 'packages']);
    assert.deepEqual(
      result,
      { stdout: 'partial', stderr: 'detail' },
      'returns captured output when adb exits with output'
    );
  }

  {
    const runner = loadRunnerWithStubs({
      childProcess: {
        execFile(_exe, _args, _options, callback) {
          const error = new Error('timed out');
          error.killed = true;
          callback(error, '', '');
        },
        spawn() {
          throw new Error('spawn should not be used in this test');
        }
      },
      resolver: {
        getAdbExe() {
          return 'adb.exe';
        }
      }
    });

    await assert.rejects(
      () => runner.runAdb(['version'], 5000),
      /Command timed out after 5s: adb version/,
      'rejects with a timeout error message when execFile is killed'
    );
  }

  {
    const child = createChildProcess();
    const runner = loadRunnerWithStubs({
      childProcess: {
        execFile() {
          throw new Error('execFile should not be used in this test');
        },
        spawn() {
          return child;
        }
      },
      resolver: {
        getAdbExe() {
          return 'adb.exe';
        }
      }
    });

    const resultPromise = runner.spawnAdbWithInactivityTimeout(['push', 'a', 'b'], 100, () => {});
    child.stdout.emit('data', Buffer.from('hello '));
    child.stderr.emit('data', Buffer.from('world'));
    child.emit('close', 0);

    const result = await resultPromise;
    assert.equal(result, 'hello', 'prefers stdout output when the spawned command succeeds');
  }

  {
    const child = createChildProcess();
    const runner = loadRunnerWithStubs({
      childProcess: {
        execFile() {
          throw new Error('execFile should not be used in this test');
        },
        spawn() {
          return child;
        }
      },
      resolver: {
        getAdbExe() {
          return 'adb.exe';
        }
      }
    });

    await assert.rejects(
      () => runner.spawnAdbWithInactivityTimeout(['pull', '/a', 'b'], 10),
      /ADB process timed out due to inactivity \(0.01s\)/,
      'rejects when no output arrives before the inactivity timeout'
    );
    assert.equal(child.killCalls, 1, 'kills the child process on inactivity timeout');
  }

  console.log('All tests passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
