// What the bottom bar's N chip says: who N goes to first and how long they have waited ("next: Byte,
// 12m"), so the first thing you read is who and how long; "next unit" when nobody waits. Pure.
import type { Ranked } from '../../../shared/attention';
import { ago } from '../../../shared/rowtext';
import { waitTone, type WaitTone } from '../../../shared/waittone';
import { nLine } from '../../nextup';

export interface NextWord {
  /** "next: Byte," or "next unit". */
  who: string;
  /** "12m" and its tone, or none when nobody waits. */
  wait?: string;
  tone?: WaitTone;
}

/** The N chip's words for this floor's ranking at `now`. */
export function nextWord(ranked: readonly Ranked[], now: number): NextWord {
  const first = nLine(ranked)[0];
  const r = first && ranked.find((x) => x.entry.id === first.id);
  if (!r) return { who: 'next unit' };
  const ms = now - r.att.since;
  return { who: `next: ${r.entry.name},`, wait: ago(ms), tone: waitTone(ms) };
}
