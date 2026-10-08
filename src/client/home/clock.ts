// The wait clocks, live: once a second, while the page is in view, each row's "waiting 38s" is
// rewritten in place from its data-since (see list.ts), so a fresh question counts up and a quick
// answer shows, without redrawing the list. Only the text changes, and only when it differs.

import { ageLabel, type InboxSection } from '../../shared/inbox';

/** Rewrites every clock under `root` for `now`. */
export function tickClocks(root: ParentNode, now = Date.now()) {
  for (const el of root.querySelectorAll<HTMLElement>('.row-age[data-since]')) {
    const since = Number(el.dataset.since);
    if (!Number.isFinite(since)) continue;
    const text = ageLabel(el.dataset.section as InboxSection, { since, snoozed: el.dataset.snoozed === '1' }, now);
    if (el.textContent !== text) el.textContent = text;
  }
}

/** Starts the one-second tick over `root`; it skips while the tab is hidden. */
export function startClocks(root: ParentNode) {
  setInterval(() => {
    if (!document.hidden) tickClocks(root);
  }, 1000);
}
