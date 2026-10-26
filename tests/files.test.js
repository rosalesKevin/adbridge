'use strict';

const assert = require('node:assert/strict');
const Module = require('node:module');

function loadFilesWithStubs(stubs) {
  const modulePath = require.resolve('../src/main/adb/files');
  delete require.cache[modulePath];

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === './runner') return stubs.runner;
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require('../src/main/adb/files');
  } finally {
    Module._load = originalLoad;
  }
}

(async () => {
  const calls = [];
  const files = loadFilesWithStubs({
    runner: {
      async runAdb() {
        throw new Error('runAdb should not be used without progress tracking');
      },
      async spawnAdbWithInactivityTimeout(args, timeoutMs) {
        calls.push({ args, timeoutMs });
        return 'Success';
      }
    }
  });

  await files.pushFile('ABC123', __filename, '/sdcard/Download/');
  await files.pullFile('ABC123', '/sdcard/big.bin', __dirname);

  assert.deepEqual(
    calls,
    [
      { args: ['-s', 'ABC123', 'push', __filename, '/sdcard/Download/'], timeoutMs: 0 },
      { args: ['-s', 'ABC123', 'pull', '/sdcard/big.bin', __dirname], timeoutMs: 0 }
    ],
    'push and pull run without an inactivity timeout so long transfers are never killed'
  );

  await assert.rejects(
    () => files.pullFile('ABC123', '/sdcard/big.bin', 'C:\\adbridge-missing-folder-xyz'),
    /Destination folder not found/,
    'rejects a saved download folder that no longer exists'
  );

  // Device shell commands: any output from mkdir/rm/mv means the device refused.
  {
    const shellCalls = [];
    let answer = { stdout: '', stderr: '' };
    const device = loadFilesWithStubs({
      runner: {
        async runAdb(args) { shellCalls.push(args[args.length - 1]); return answer; },
        async spawnAdbWithInactivityTimeout() { return 'ok'; }
      }
    });

    answer = { stdout: '', stderr: "mkdir: '/sdcard/DCIM': File exists" };
    await assert.rejects(() => device.makeDirectory('D', '/sdcard/DCIM'), /File exists/, 'mkdir reports a refused folder as an error');
    answer = { stdout: '', stderr: '' };
    assert.equal(await device.makeDirectory('D', '/sdcard/New'), 'Directory created', 'mkdir with no output succeeds');

    answer = { stdout: '', stderr: 'rm: /sdcard/x: Permission denied' };
    await assert.rejects(() => device.deleteEntry('D', '/sdcard/x'), /Permission denied/, 'rm reports a refused delete as an error');
    answer = { stdout: '', stderr: '' };
    assert.equal(await device.deleteEntry('D', '/sdcard/x'), 'Deleted', 'rm with no output succeeds');

    answer = { stdout: '', stderr: 'ls: /data: Permission denied' };
    await assert.rejects(() => device.listDirectory('D', '/data/'), /Permission denied/, 'a folder that cannot be read is an error, not an empty folder');
    answer = { stdout: '', stderr: 'ls: /sdcard/typo: No such file or directory' };
    await assert.rejects(() => device.listDirectory('D', '/sdcard/typo/'), /No such file/, 'a missing folder is an error');
    answer = { stdout: 'total 0', stderr: '' };
    assert.deepEqual(await device.listDirectory('D', '/sdcard/Empty/'), [], 'a genuinely empty folder lists nothing');

    shellCalls.length = 0;
    answer = { stdout: 'EXISTS', stderr: '' };
    await assert.rejects(() => device.renameEntry('D', '/sdcard/Documents', 'Pictures'), /already exists/, 'refuses to rename onto an existing name');
    assert.match(shellCalls[0], /\[ -e '\/sdcard\/Pictures' \]/, 'checks the target name on the device before moving');
    answer = { stdout: '', stderr: "mv: can't rename '/sdcard/a': Permission denied" };
    await assert.rejects(() => device.renameEntry('D', '/sdcard/a', 'b'), /Permission denied/, 'mv errors are reported');
    answer = { stdout: '', stderr: '' };
    assert.equal(await device.renameEntry('D', '/sdcard/a', 'b'), 'Renamed', 'a clean rename succeeds');

    // Listing carries the modified date (toybox: sortable timestamp; busybox: display only).
    answer = {
      stdout: [
        'total 16',
        'drwxrwx--x 2 root sdcard_rw 4096 2026-10-25 23:41 DCIM',
        '-rw-rw---- 1 u0_a12 media_rw 2048 2026-01-02 08:05 notes.txt',
        '-rw-r--r-- 1 root root 77 Oct 25 12:00 old-busybox.txt'
      ].join('\n'),
      stderr: ''
    };
    const listed = await device.listDirectory('D', '/sdcard/');
    assert.deepEqual(listed.map((e) => [e.name, e.modified, typeof e.modifiedMs]), [
      ['DCIM', '2026-10-25 23:41', 'number'],
      ['notes.txt', '2026-01-02 08:05', 'number'],
      ['old-busybox.txt', 'Oct 25 12:00', 'object']
    ], 'parses modified dates from both ls formats');
    assert.ok(listed[0].modifiedMs > listed[1].modifiedMs, 'toybox timestamps compare chronologically');

    // stat-based properties
    answer = { stdout: 'regular file|2048|-rw-rw----|u0_a12|media_rw|2026-01-02 08:05:07.000000000 +0200', stderr: '' };
    assert.deepEqual(await device.statEntry('D', '/sdcard/notes.txt'), {
      type: 'regular file', size: 2048, permissions: '-rw-rw----', owner: 'u0_a12', group: 'media_rw', modified: '2026-01-02 08:05:07'
    }, 'reads file properties with stat');
    answer = { stdout: '', stderr: "stat: '/sdcard/gone': No such file or directory" };
    await assert.rejects(() => device.statEntry('D', '/sdcard/gone'), /No such file/, 'stat errors are reported');
  }

  // On-device copy/move: no timeout (big folders), same name-collision rule as rename.
  {
    const spawned = [];
    let output = 'Success';
    const device = loadFilesWithStubs({
      runner: {
        async runAdb() { return { stdout: '', stderr: '' }; },
        async spawnAdbWithInactivityTimeout(args, timeoutMs) { spawned.push({ command: args[args.length - 1], timeoutMs }); return output; }
      }
    });

    assert.equal(await device.copyEntry('D', '/sdcard/DCIM/a b.jpg', '/sdcard/Pictures/'), 'Copied', 'copies into the destination folder');
    assert.deepEqual(spawned[0], {
      command: "if [ -e '/sdcard/Pictures/a b.jpg' ]; then echo EXISTS; else cp -r '/sdcard/DCIM/a b.jpg' '/sdcard/Pictures/a b.jpg'; fi",
      timeoutMs: 0
    }, 'copy checks the target name first and never times out');

    assert.equal(await device.moveEntry('D', '/sdcard/Old/', '/sdcard/Archive/'), 'Moved', 'moves a folder into another folder');
    assert.match(spawned[1].command, /mv '\/sdcard\/Old' '\/sdcard\/Archive\/Old'/, 'moves use mv with the folder name kept');

    output = 'EXISTS';
    await assert.rejects(() => device.copyEntry('D', '/sdcard/a.txt', '/sdcard/b/'), /already exists/, 'refuses to overwrite on paste');
    output = "cp: /sdcard/x: Permission denied";
    await assert.rejects(() => device.copyEntry('D', '/sdcard/x', '/sdcard/b/'), /Permission denied/, 'device errors are reported');

    const before = spawned.length;
    await assert.rejects(() => device.moveEntry('D', '/sdcard/A/', '/sdcard/A/B/'), /into itself/, 'refuses to move a folder into itself');
    await assert.rejects(() => device.moveEntry('D', '/sdcard/A/x.txt', '/sdcard/A/'), /already in this folder/, 'refuses a move to the same folder');
    assert.equal(spawned.length, before, 'refused moves never reach the device');
  }

  console.log('All tests passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
