export const MASCOT_ACTIONS = ['walk', 'wave', 'nap', 'fish', 'dance', 'juggle', 'charge'];

/** Random idle action, never the same as the previous one. */
export function pickAction(previous, random = Math.random) {
  const choices = MASCOT_ACTIONS.filter((action) => action !== previous);
  return choices[Math.floor(random() * choices.length)];
}

/**
 * Mascot lifecycle: hidden → entering → acting → leaving → hidden.
 * Events: 'idle' / 'summon' bring it in, 'arrived' starts the action,
 * 'switch' (still idle a minute later) moves on to a new action,
 * 'interact' sends it off, 'gone' hides it.
 */
export function mascotTransition(phase, event) {
  switch (phase) {
    case 'hidden':
      return event === 'idle' || event === 'summon' ? 'entering' : 'hidden';
    case 'entering':
      if (event === 'arrived') return 'acting';
      return event === 'interact' ? 'leaving' : 'entering';
    case 'acting':
      if (event === 'switch') return 'entering';
      return event === 'interact' ? 'leaving' : 'acting';
    case 'leaving':
      return event === 'gone' ? 'hidden' : 'leaving';
    default:
      return 'hidden';
  }
}
