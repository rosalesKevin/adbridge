import { dom } from './dom.js';
import { getSettings } from './settings.js';
import { prefersReducedMotion } from './utils.js';
import { pickAction, mascotTransition } from './mascot-state.mjs';

// Idle mascot: after a minute without input, or a click on the head that peeks from the
// bottom-right corner, a droid walks in and does a random action, switching to another one
// every minute, until the user clicks, types or scrolls again. Plain mouse movement doesn't count, so it can be watched.
const IDLE_MS = 60000;
const PEEK_EVERY_MS = 10000;
const SWITCH_MS = 60000; // still idle after a minute of one action: pick another
const BOT_W = 48;
const UNIT_PX = 0.8; // the 60x70 robot viewBox is drawn at 48x56 px
const BRIDGE_W = 150;
const BRIDGE_SEAT = 44; // px above the floor where the droid stands on the arch

const ROBOT_SVG = `
<svg class="m-svg" viewBox="0 0 60 70" width="48" height="56" overflow="visible">
  <g class="m-body">
    <g class="m-rod"><path class="m-rod-pole" d="M50 40 L68 22"/><path class="m-line" d="M68 22 V100"/><circle class="m-bobber" cx="68" cy="100" r="3.2"/><rect class="m-catch" x="62" y="84" width="11" height="12" rx="2"/></g>
    <g class="m-charge-cable"><path class="m-wire" d="M30 8 C30 -12 52 -28 96 -56"/><rect class="m-plug" x="26.5" y="6" width="7" height="6" rx="1.5"/></g>
    <rect class="m-leg m-leg-l" x="21" y="50" width="7" height="14" rx="3.5"/>
    <rect class="m-leg m-leg-r" x="32" y="50" width="7" height="14" rx="3.5"/>
    <rect class="m-arm m-arm-l" x="6" y="29" width="6" height="17" rx="3"/>
    <rect class="m-arm m-arm-r" x="48" y="29" width="6" height="17" rx="3"/>
    <g class="m-torso">
      <g class="m-antennae"><path d="M22 14 L17 6"/><path d="M38 14 L43 6"/></g>
      <path class="m-fill" d="M14 26 A16 16 0 0 1 46 26 Z"/>
      <g class="m-eyes"><circle cx="24" cy="19.5" r="2.1"/><circle cx="36" cy="19.5" r="2.1"/></g>
      <path class="m-eyes-shut" d="M21.5 20 H26.5 M33.5 20 H38.5"/>
      <g class="m-eyes-spin"><circle cx="24" cy="19.5" r="2.6"/><circle cx="36" cy="19.5" r="2.6"/></g>
      <rect class="m-fill" x="14" y="28" width="32" height="24" rx="5"/>
    </g>
    <g class="m-balls"><rect class="m-ball m-ball-1" x="-5.5" y="-6" width="11" height="12" rx="2.5"/><rect class="m-ball m-ball-2" x="-5.5" y="-6" width="11" height="12" rx="2.5"/><rect class="m-ball m-ball-3" x="-5.5" y="-6" width="11" height="12" rx="2.5"/></g>
    <g class="m-stars"><path d="M22 -2 l1.2 2.8 2.8 1.2 -2.8 1.2 -1.2 2.8 -1.2 -2.8 -2.8 -1.2 2.8 -1.2z"/><path d="M38 -2 l1.2 2.8 2.8 1.2 -2.8 1.2 -1.2 2.8 -1.2 -2.8 -2.8 -1.2 2.8 -1.2z"/><path d="M30 -8 l1 2.2 2.2 1 -2.2 1 -1 2.2 -1 -2.2 -2.2 -1 2.2 -1z"/></g>
  </g>
</svg>`;

const PEEK_SVG = `
<svg viewBox="0 0 60 44" width="36" height="26" overflow="visible">
  <rect class="m-peek-arm" x="50" y="16" width="6" height="17" rx="3"/>
  <path class="m-antenna-line" d="M22 28 L17 20 M38 28 L43 20"/>
  <path class="m-fill" d="M14 42 A16 16 0 0 1 46 42 Z"/>
  <circle class="m-eye" cx="24" cy="34.5" r="2.1"/><circle class="m-eye" cx="36" cy="34.5" r="2.1"/>
</svg>`;

const BRIDGE_SVG = `
<svg class="m-bridge" viewBox="0 0 150 60" width="150" height="60">
  <path class="m-arch" d="M8 60 C30 -4 120 -4 142 60"/>
  <path class="m-antenna-line" d="M42 20 L35 8 M108 20 L115 8"/>
</svg>`;

let stage, bot, svg, peek, bridge, zzz, notes, battery, line, bobber, catchBox;
let phase = 'hidden';
let action = null;
let lastAction = null;
let x = -BOT_W;
let dir = 1;
let bottom = 0;
let move = null; // { kind: 'to', target, speed, done } or { kind: 'patrol', speed }
let bridgeLeft = 0;
let frame = 0;
let lastTime = 0;
let idleTimer = 0;
let timers = [];

function later(ms, fn) {
  timers.push(setTimeout(fn, ms));
}

function clearLater() {
  timers.forEach(clearTimeout);
  timers = [];
}

function allowed() {
  return getSettings().mascot !== false && !prefersReducedMotion() && !document.hidden
    && !document.querySelector('.confirm-overlay.open');
}

function pose(...classes) {
  bot.className = ['m-bot', 'm-on', ...classes].join(' ');
}

function moveTo(target, speed, done) {
  dir = target >= x ? 1 : -1;
  move = { kind: 'to', target, speed, done };
}

function patrol(speed) {
  move = { kind: 'patrol', speed };
}

// Speeds are px per second, so the pace is the same on 60 Hz and 144 Hz screens.
function tick(now) {
  const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
  lastTime = now;
  if (move?.kind === 'to') {
    x += move.speed * dt * dir;
    if ((dir > 0 && x >= move.target) || (dir < 0 && x <= move.target)) {
      x = move.target;
      const { done } = move;
      move = null;
      done?.();
    }
  } else if (move?.kind === 'patrol') {
    const max = stage.clientWidth - BOT_W;
    x += move.speed * dt * dir;
    if (x >= max) { x = max; dir = -1; }
    if (x <= 0) { x = 0; dir = 1; }
  }

  bot.style.left = `${x}px`;
  bot.style.bottom = `${bottom}px`;
  svg.style.transform = `scaleX(${dir})`;
  zzz.style.left = `${x + 36}px`;
  zzz.style.bottom = `${bottom + 44}px`;
  notes.style.left = `${x + 6}px`;
  notes.style.bottom = `${bottom + 50}px`;
  battery.style.left = `${x + 11}px`;
  battery.style.bottom = `${bottom + 66}px`;

  if (phase !== 'hidden') frame = requestAnimationFrame(tick);
}

function setFishingLine() {
  const end = 70 + bottom / UNIT_PX - 4; // down to the floor, in robot units
  line.setAttribute('d', `M68 22 V${end}`);
  bobber.setAttribute('cy', end);
  catchBox.setAttribute('y', end - 16);
}

function bonk() {
  pose('m-juggle', 'm-bonk');
  later(1900, () => {
    pose('m-juggle');
    later(6500, bonk);
  });
}

function chargeUp() {
  move = null;
  pose('m-plugged');
  stage.classList.remove('m-charging');
  void battery.offsetWidth; // restart the fill transition
  stage.classList.add('m-charging');
  later(3600, () => {
    stage.classList.remove('m-charging');
    pose('m-running', 'm-hyper');
    patrol(330);
  });
  later(8200, chargeUp);
}

const ACTIONS = {
  walk() { pose('m-walking'); patrol(55); },
  wave() { dir = 1; pose('m-wave'); },
  nap() { pose('m-nap'); },
  fish() {
    pose('m-walking');
    bottom = BRIDGE_SEAT;
    later(450, () => { setFishingLine(); pose('m-fish'); });
  },
  dance() { pose('m-dance'); },
  juggle() { dir = 1; pose('m-juggle'); later(6000, bonk); },
  charge() { chargeUp(); }
};

// Walks in from the left, or, when switching actions, walks over from where it already is.
function enter() {
  const onStage = bot.classList.contains('m-on');
  clearLater();
  stage.classList.remove('m-charging');

  action = pickAction(lastAction);
  lastAction = action;
  stage.dataset.action = action;

  const width = stage.clientWidth;
  let target = Math.round(width * (0.25 + Math.random() * 0.35));
  if (action === 'fish') {
    bridgeLeft = Math.round(width * 0.55 - BRIDGE_W / 2);
    bridge.style.left = `${bridgeLeft}px`;
    target = bridgeLeft + BRIDGE_W / 2 - BOT_W / 2;
  }

  if (!onStage) {
    x = -BOT_W;
    dir = 1;
  }
  bottom = 0;
  pose('m-walking');
  moveTo(target, 150, () => send('arrived'));
  if (!onStage) {
    cancelAnimationFrame(frame);
    lastTime = 0;
    frame = requestAnimationFrame(tick);
  }
}

function leave() {
  clearLater();
  stage.classList.remove('m-charging');
  const run = () => {
    const toLeft = x + BOT_W / 2 < stage.clientWidth / 2;
    pose('m-running');
    moveTo(toLeft ? -BOT_W - 8 : stage.clientWidth + 8, 420, () => send('gone'));
  };
  later(2500, () => send('gone')); // never stay on stage if frames get throttled
  if (bottom > 0) {
    move = null;
    bottom = 0; // hop off the bridge first
    pose('m-walking');
    later(380, run);
  } else {
    run();
  }
}

function hide() {
  clearLater();
  cancelAnimationFrame(frame);
  move = null;
  bot.className = 'm-bot';
  stage.removeAttribute('data-action');
  stage.classList.remove('m-charging');
  x = -BOT_W;
  bottom = 0;
  resetIdle();
}

function send(event) {
  const next = mascotTransition(phase, event);
  if (next === phase) return;
  phase = next;
  if (phase === 'entering') enter();
  else if (phase === 'acting') {
    ACTIONS[action]();
    later(SWITCH_MS, () => send('switch'));
  }
  else if (phase === 'leaving') leave();
  else hide();
}

function forceHide() {
  if (phase === 'hidden') return;
  phase = 'hidden';
  hide();
}

function resetIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (phase === 'hidden' && allowed()) send('idle');
    else resetIdle();
  }, IDLE_MS);
}

function onInteract() {
  resetIdle();
  send('interact');
}

function maybePeek() {
  if (phase !== 'hidden' || !allowed() || peek.classList.contains('m-peeking')) return;
  peek.classList.add('m-peeking');
}

export function initMascot() {
  stage = dom.mascotStage;
  stage.innerHTML = `${BRIDGE_SVG}
    <div class="m-zzz"><span>z</span><span>z</span><span>Z</span></div>
    <div class="m-notes"><span>♪</span><span>♫</span><span>♪</span></div>
    <div class="m-battery"><div class="m-battery-fill"></div></div>
    <div class="m-bot">${ROBOT_SVG}</div>
    <div class="m-peek">${PEEK_SVG}</div>`;
  bridge = stage.querySelector('.m-bridge');
  zzz = stage.querySelector('.m-zzz');
  notes = stage.querySelector('.m-notes');
  battery = stage.querySelector('.m-battery');
  bot = stage.querySelector('.m-bot');
  svg = stage.querySelector('.m-svg');
  peek = stage.querySelector('.m-peek');
  line = stage.querySelector('.m-line');
  bobber = stage.querySelector('.m-bobber');
  catchBox = stage.querySelector('.m-catch');

  for (const type of ['pointerdown', 'keydown', 'wheel']) {
    window.addEventListener(type, onInteract, { capture: true, passive: true });
  }
  let lastMove = 0;
  window.addEventListener('mousemove', () => {
    if (phase !== 'hidden' || Date.now() - lastMove < 1000) return;
    lastMove = Date.now();
    resetIdle();
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) forceHide();
  });
  dom.mascotChk.addEventListener('change', () => {
    if (!dom.mascotChk.checked) forceHide();
  });

  peek.addEventListener('animationend', (event) => {
    if (event.animationName === 'm-peek') peek.classList.remove('m-peeking');
  });
  peek.addEventListener('click', () => {
    if (!peek.classList.contains('m-peeking')) return;
    peek.classList.remove('m-peeking');
    send('summon');
  });

  setInterval(maybePeek, PEEK_EVERY_MS);
  resetIdle();
}
