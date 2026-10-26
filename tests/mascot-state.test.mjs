import assert from 'node:assert/strict';

import { MASCOT_ACTIONS, pickAction, mascotTransition } from '../src/renderer/modules/mascot-state.mjs';

assert.deepEqual(
  MASCOT_ACTIONS,
  ['walk', 'wave', 'nap', 'fish', 'dance', 'juggle', 'charge'],
  'offers the seven idle actions (cable trip was removed)'
);

{
  for (const previous of MASCOT_ACTIONS) {
    for (const r of [0, 0.25, 0.5, 0.75, 0.9999]) {
      const action = pickAction(previous, () => r);
      assert.ok(MASCOT_ACTIONS.includes(action), `picks a known action (prev=${previous}, r=${r})`);
      assert.notEqual(action, previous, `never repeats the previous action (prev=${previous}, r=${r})`);
    }
  }
  assert.ok(MASCOT_ACTIONS.includes(pickAction(null, () => 0.5)), 'works on the first run with no previous action');
}

{
  assert.equal(mascotTransition('hidden', 'idle'), 'entering', 'idle time brings the mascot in');
  assert.equal(mascotTransition('hidden', 'summon'), 'entering', 'clicking the peeking head brings it in');
  assert.equal(mascotTransition('hidden', 'interact'), 'hidden', 'normal use while hidden changes nothing');
  assert.equal(mascotTransition('entering', 'arrived'), 'acting', 'starts its action once it has walked in');
  assert.equal(mascotTransition('entering', 'interact'), 'leaving', 'leaves if the user comes back while it walks in');
  assert.equal(mascotTransition('acting', 'interact'), 'leaving', 'leaves as soon as the user interacts');
  assert.equal(mascotTransition('acting', 'idle'), 'acting', 'keeps its one action while still idle');
  assert.equal(mascotTransition('acting', 'summon'), 'acting', 'ignores the peek trigger while already on stage');
  assert.equal(mascotTransition('leaving', 'interact'), 'leaving', 'keeps running off when clicked again');
  assert.equal(mascotTransition('leaving', 'gone'), 'hidden', 'hides once it is off stage');
  assert.equal(mascotTransition('leaving', 'idle'), 'leaving', 'does not come back mid-exit');
  assert.equal(mascotTransition('acting', 'switch'), 'entering', 'still idle after a minute: moves on to a new action');
  assert.equal(mascotTransition('hidden', 'switch'), 'hidden', 'a stale switch never brings it back');
  assert.equal(mascotTransition('entering', 'switch'), 'entering', 'ignores a switch while already walking to a spot');
  assert.equal(mascotTransition('leaving', 'switch'), 'leaving', 'ignores a switch while running off');
}

console.log('All tests passed.');
