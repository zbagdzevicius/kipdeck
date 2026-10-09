// How a wait reads at a glance: fresh, aging (over 5 minutes, bold) or stale (over 30 minutes, heavier
// and underlined). A clock escalates by weight and emphasis, never by colour: the colours already say
// what a unit is (needs you orange, stuck red, to review yellow), so a late clock borrowing one would
// contradict its own row. Every clock that says how long a unit has waited on someone takes its tone from here (the
// rail, Mission control, the selected unit's card, the callouts over the units, the pod plates and the
// needs-you chip), so the same wait never looks calm in one place and late in another. Pure, so the
// server, both clients and the tests can use it.

import type { AttentionLevel } from './attention.js';
import { ago } from './rowtext.js';

export type WaitTone = 'fresh' | 'aging' | 'stale';

/** Waiting this long, a wait turns bold. */
export const AGING_MS = 5 * 60_000;
/** Waiting this long, it turns heavier and underlined. */
export const STALE_MS = 30 * 60_000;

/** The tone of a wait `ms` long. */
export function waitTone(ms: number): WaitTone {
  if (ms >= STALE_MS) return 'stale';
  if (ms >= AGING_MS) return 'aging';
  return 'fresh';
}

/** The font weight a clock is drawn at in each tone (the page's clocks and the canvases' alike). */
export const WAIT_WEIGHT: Record<WaitTone, number> = { fresh: 500, aging: 700, stale: 800 };

/** Whether a level's clock is someone waiting on a person (needs you, stuck, to review): only those take a tone. */
export function waitsOnPerson(level: AttentionLevel): boolean {
  return level === 'needs-you' || level === 'stuck' || level === 'review';
}

/** A unit's clock ('12m') and its tone: a tone only when it waits on a person (a working unit's time is never late). */
export function waitClock(level: AttentionLevel, ms: number): { text: string; tone?: WaitTone } {
  const text = ago(ms);
  return waitsOnPerson(level) ? { text, tone: waitTone(ms) } : { text };
}
