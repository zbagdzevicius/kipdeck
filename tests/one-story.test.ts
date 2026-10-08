// One name, one story: the numbers and the words that repeat across the app, the bridge, the README
// and the landing page come from one place and agree. Who is "waiting on you" (the tab title, the
// pulse and the home page's sections), what lights the tab's mark, the five state names, the wait
// clocks and thresholds, and the tagline and description wherever they are written down.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { attention, needsYou, rankRoster, STATE_LABEL, LEVEL_LABEL, WAIT_FULL_MS as FULL, WAIT_HOT_MS, waitsOnYou } from '../src/shared/attention.js';
import { buildInbox, INBOX_SECTIONS, SECTION_LABEL, sectionOf, WAIT_FULL_MS } from '../src/shared/inbox.js';
import { ago } from '../src/shared/rowtext.js';
import { waitWords } from '../src/shared/metrics.js';
import { DESCRIPTION, PRODUCT, TAGLINE, tabTitle } from '../src/shared/copy.js';
import { SOURCE_RUN_COMMAND, CLONE_COMMAND } from '../src/shared/demo.js';
import { BRANDS } from '../site/landing/brand.ts';
import type { RosterEntry } from '../src/shared/protocol.js';

const root = path.join(import.meta.dirname, '..');
const read = (f: string) => readFileSync(path.join(root, f), 'utf8');
const NOW = new Date(2026, 9, 8, 15, 0, 0).getTime();
const MIN = 60_000;

function entry(over: Partial<RosterEntry> = {}): RosterEntry {
  return { id: 'w1', floor: 'f1', floorName: 'api', deskId: 'desk-1', name: 'Mochi', color: '#fff', kind: 'agent', provider: 'claude', status: 'working', acked: true, createdAt: NOW - 60 * MIN, tasked: true, workingSince: NOW - 2 * MIN, ...over };
}

/** One of each: asking, crashed, finished, a PR to review, merged, working, ready, asleep, snoozed. */
const roster: RosterEntry[] = [
  entry({ id: 'ask', status: 'needs_input', waitingSince: NOW - 12 * MIN }),
  entry({ id: 'crash', status: 'exited', exitCode: 2 }),
  entry({ id: 'done', status: 'done', acked: false, waitingSince: NOW - 9 * MIN }),
  entry({ id: 'pr', status: 'idle', pr: { number: 9, state: 'open' } as RosterEntry['pr'] }),
  entry({ id: 'merged', status: 'idle', pr: { number: 3, state: 'merged' } as RosterEntry['pr'] }),
  entry({ id: 'work' }),
  entry({ id: 'ready', status: 'idle', tasked: true }),
  entry({ id: 'asleep', status: 'offline' }),
  entry({ id: 'snoozed', status: 'needs_input', snooze: { until: 'change', by: 'Ana', at: NOW } }),
];

test('"waiting on you" is one rule: the tab title, the pulse and the Needs you and To review sections count the same agents', () => {
  const ranked = rankRoster(roster, NOW);
  const view = buildInbox(ranked);
  const inSections = [...view.sections['needs-you'], ...view.sections.review].map((r) => r.entry.id).sort();
  const waiting = ranked.filter((r) => waitsOnYou(r.att)).map((r) => r.entry.id).sort();
  assert.deepEqual(waiting, inSections);
  assert.ok(!waiting.includes('merged'), 'a merged pull request only waits to be archived');
  assert.ok(!waiting.includes('snoozed'));
  for (const r of ranked) {
    assert.equal(waitsOnYou(r.att), ['needs-you', 'review'].includes(sectionOf(r.att)), r.entry.id);
    // The tab's mark is lit for exactly the Needs you section: a question, or stuck.
    assert.equal(needsYou(r.att), sectionOf(r.att) === 'needs-you', r.entry.id);
  }
  assert.ok(needsYou(attention(roster[1], NOW)), 'a crashed agent lights the mark too');
});

test('the tab title says the count, the project and the name in plain ASCII', () => {
  assert.equal(tabTitle(2, 'acme-shop'), '(2) acme-shop - Kipdeck');
  assert.equal(tabTitle(0, 'acme-shop'), 'acme-shop - Kipdeck');
  assert.equal(tabTitle(0), PRODUCT);
});

test('five states, named once: the sections and the ranking use STATE_LABEL', () => {
  assert.deepEqual(Object.values(STATE_LABEL), ['Needs you', 'Stuck', 'To review', 'Working', 'Ready']);
  assert.equal(LEVEL_LABEL, STATE_LABEL);
  for (const s of INBOX_SECTIONS) assert.ok(Object.values(STATE_LABEL).includes(SECTION_LABEL[s]), `${s} is called ${SECTION_LABEL[s]}`);
});

test('one wait clock: a row and the pulse say the same minutes, and the thresholds live in attention.ts', () => {
  for (let s = 60; s <= 3 * 3600; s += 7) {
    const row = ago(s * 1000);
    const words = waitWords(s * 1000);
    const minutes = Math.floor(s / 60);
    if (minutes < 60) assert.equal(words, row, `${s}s`);
    else assert.ok(words.startsWith(`${Math.floor(minutes / 60)}h`), `${s}s: ${words} vs ${row}`);
  }
  assert.equal(waitWords(90_000), '1m');
  assert.equal(ago(90_000), '1m');
  assert.equal(waitWords(38_000), '38s');
  assert.equal(WAIT_FULL_MS, FULL);
  assert.equal(WAIT_HOT_MS, 5 * MIN);
});

test('one tagline and one description: README, package.json, the installers, the sign-in page and the landing page', () => {
  assert.equal(TAGLINE, 'The inbox for your AI coding agents.');
  assert.match(DESCRIPTION, /control and clarity/);
  assert.match(DESCRIPTION, /in one place/);
  const readme = read('README.md');
  assert.ok(readme.includes(`${TAGLINE} ${DESCRIPTION}`), 'README opens with the tagline and the description');
  const pkg = JSON.parse(read('package.json')) as { description: string };
  assert.ok(pkg.description.startsWith(`${PRODUCT}: ${TAGLINE.charAt(0).toLowerCase()}${TAGLINE.slice(1)} ${DESCRIPTION}`), pkg.description);
  const inSentence = TAGLINE.charAt(0).toLowerCase() + TAGLINE.slice(1, -1);
  for (const f of ['install.sh', 'install.ps1']) assert.ok(read(f).includes(`Install Kipdeck (${inSentence})`), f);
  assert.ok(read('src/client/login.html').includes(`<p class="sub" id="sub">${TAGLINE}</p>`));
  assert.ok(read('src/client/index.html').includes(`aria-label="${PRODUCT}, ${inSentence}"`));
  assert.ok(read('src/server/config.ts').includes(`kipdeck - ${inSentence} (`), 'the CLI help');
  assert.equal(BRANDS.kipdeck.tagline, TAGLINE);
  assert.ok(BRANDS.kipdeck.ogDescription.startsWith(DESCRIPTION));
  // One way to say it: no older taglines left in the app's own pages.
  for (const f of ['src/client/showcase/index.html', 'src/client/login.html', 'src/client/index.html', 'src/server/config.ts']) assert.doesNotMatch(read(f), /mission control for|one inbox for every/i, f);
});

test('the command to run a clone is the one the landing page and the README give', () => {
  assert.equal(CLONE_COMMAND, 'git clone https://github.com/zbagdzevicius/kipdeck kipdeck');
  assert.match(read('site/landing/index.html'), /node ~\/\{\{folder\}\}\/bin\/agent-office\.js/);
  assert.equal(SOURCE_RUN_COMMAND, `node ~/${BRANDS.kipdeck.folder}/bin/agent-office.js`);
});

test('every doc says Kipdeck in its opening lines', () => {
  const files = readdirSync(path.join(root, 'docs')).filter((f) => f.endsWith('.md'));
  assert.ok(files.length > 10);
  for (const f of files) assert.match(read(`docs/${f}`).split('\n').slice(0, 6).join('\n'), /Kipdeck/, `docs/${f}`);
  assert.doesNotMatch(read('docs/features.md'), /\*\*\*\*/, 'no empty bold left where an icon was');
});
