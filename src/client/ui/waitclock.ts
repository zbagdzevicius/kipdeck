/**
 * A unit's wait clock on the page: '12m' in its wait's tone (shared/waittone.ts), fresh in the text's
 * white, aging amber, stale red and bold. It ticks to the minute, never by the second: when the minute
 * it shows changes, the new one fades in (320 ms), and a change of tone eases its color over 200 ms.
 * Under reduced motion both cut (styles/tokens.css). The rail, Mission control, the selected unit's
 * card and the needs-you chip all draw their clocks here, so they look and move the same.
 */
import './waitclock.css';
import type { AttentionLevel } from '../../shared/attention';
import { waitClock, type WaitTone } from '../../shared/waittone';
import { h } from './dom';

/** What each keyed clock showed last, for clocks drawn anew on each render (the rail's rows): a change still ticks. */
const shown = new Map<string, string>();

/** Draws `text` in `tone` (none: a plain muted clock) into `el`; with `key`, remembered across redraws so a new minute ticks in. */
export function paintWait(el: HTMLElement, text: string, tone?: WaitTone, key?: string): void {
  el.classList.add('wait-clock');
  if (tone) el.dataset.tone = tone;
  else delete el.dataset.tone;
  const was = key ? shown.get(key) : el.textContent;
  if (el.textContent !== text) el.textContent = text;
  if (key) shown.set(key, text);
  if (!was || was === text) return;
  el.classList.remove('tick');
  // Read back, so taking the class off and putting it on again starts the fade over.
  void el.offsetWidth;
  el.classList.add('tick');
}

/** A clock for a unit at `level` that has been so for `ms`: toned only when it waits on a person. */
export function waitSpan(level: AttentionLevel, ms: number, key?: string, cls = ''): HTMLElement {
  const el = h('span', { class: cls || undefined, title: 'How long it has waited' });
  const c = waitClock(level, ms);
  paintWait(el, c.text, c.tone, key);
  return el;
}
