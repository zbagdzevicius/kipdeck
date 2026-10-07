// What the collector alone says (shared/rundown/infer.ts and model.ts), the page drawn from it
// (html.ts), and the holo city laid out from it (features/rundown/logic.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inferParts, inferStatus, partMetrics } from '../src/shared/rundown/infer.js';
import { emptyMetrics } from '../src/shared/rundown/schema.js';
import { renderPage } from '../src/shared/rundown/html.js';
import { CITY, cityLayout, statusMoves, towerHeight } from '../src/client/features/rundown/logic.js';
import { NOW, sampleFacts, sampleRundown } from './support/rundown-sample.js';

test('parts are the biggest folders, descending into one that holds most of the code, plus the rest', () => {
  const parts = inferParts(sampleFacts());
  assert.deepEqual(parts.map((p) => p.id), ['src-server', 'src-client', 'tests', 'docs']);
  assert.deepEqual(parts[0].paths, ['src/server/**']);
});

test('each folder counts toward the most specific part covering it', () => {
  const m = partMetrics([{ id: 'all', paths: ['*'] }, { id: 'server', paths: ['src/server/**'] }], sampleFacts());
  assert.equal(m.get('server')!.lines, 3000);
  assert.equal(m.get('all')!.lines, 1720);
  assert.equal(m.get('all')!.uncommitted, 1);
  assert.equal(m.get('server')!.lastCommit, '2026-10-06T10:00:00Z');
});

test('inferred statuses: recent commits or changes are in progress, almost nothing is not started, the rest done, never stuck', () => {
  assert.equal(inferStatus({ ...emptyMetrics(), lines: 500, lastCommit: '2026-10-01T00:00:00Z' }, NOW).status, 'in-progress');
  assert.equal(inferStatus({ ...emptyMetrics(), lines: 500, uncommitted: 2 }, NOW).status, 'in-progress');
  assert.equal(inferStatus({ ...emptyMetrics(), lines: 10 }, NOW).status, 'not-started');
  assert.equal(inferStatus({ ...emptyMetrics(), lines: 500, lastCommit: '2026-08-01T00:00:00Z' }, NOW).status, 'done');
  const r = sampleRundown();
  assert.ok(r.parts.every((p) => p.statusSource === 'inferred' && p.status !== 'stuck'));
  assert.deepEqual(r.facts.git!.recentCommits[0].parts, ['src-server']);
});

test("Claude's parts, the person's milestones and decisions win; the next milestone is the first not done", () => {
  const r = sampleRundown({
    judgement: { parts: [{ id: 'api', name: 'API', summary: 's', paths: ['src/server/**'], status: 'stuck', waitingOn: 'a key' }], nextStep: { text: 'Get the key', why: 'Everything waits on it', partId: 'api' }, decisions: [{ id: 'D2', question: 'New?', options: ['a'], default: 'a', raised: '2026-10-07' }] },
    milestonesMd: '# Milestones\n\n## M1. One\n\n- [x] a\n\n## M2. Two\n\n- [ ] b\n- [x] c\n',
    decisionsMd: '### D1. Old (raised 2026-10-01)\nQuestion: Old?\nOptions: x / y\nDEFAULT: x\nAnswer: y\n',
  });
  assert.equal(r.parts[0].statusSource, 'claude');
  assert.equal(r.parts[0].waitingOn, 'a key');
  assert.equal(r.nextMilestone, 'M2');
  assert.deepEqual(r.milestones.map((m) => m.state), ['done', 'active']);
  assert.deepEqual(r.decisions.map((d) => [d.id, d.answer]), [['D2', null], ['D1', 'y']]);
  assert.equal(r.nextStep?.milestoneId, 'M2');
});

test('the page is one self-contained file: no external URL, the model embedded safely, every status in words', () => {
  const r = sampleRundown({ judgement: { parts: [{ id: 'api', name: '</script><img src=x onerror=alert(1)>', summary: 's', paths: ['src/**'], status: 'stuck', waitingOn: 'x' }] } });
  const html = renderPage(r, NOW);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=|https?:\/\/(?!www\.w3\.org)/);
  assert.equal(html.match(/<\/script>/g)?.length, 2, 'the embedded JSON never closes its script early');
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /Content-Security-Policy/);
  for (const w of ['Done', 'In progress', 'Not started', 'Stuck']) assert.ok(html.includes(w), w);
  assert.ok(html.length < 600_000);
  assert.doesNotMatch(html.replace(/<script[\s\S]*?<\/script>/g, ''), /[–—]/, 'plain ASCII dashes');
});

test('the holo city: a district per part inside the table, towers capped and low in the middle, pulses for this week', () => {
  const r = sampleRundown({ judgement: { parts: [{ id: 'api', name: 'API', summary: '', paths: ['src/server/**'], status: 'in-progress' }, { id: 'rest', name: 'Rest', summary: '', paths: ['*'], status: 'done' }], nextStep: { text: 'x', why: 'y', partId: 'api' } } });
  const L = cityLayout(r, NOW);
  assert.deepEqual(L.districts.map((d) => d.id).sort(), ['api', 'rest']);
  for (const d of L.districts) assert.ok(Math.abs(d.x) + d.w / 2 <= CITY.size / 2 + 1e-9 && Math.abs(d.z) + d.d / 2 <= CITY.size / 2 + 1e-9);
  for (const t of L.towers) assert.ok(t.h <= CITY.maxH && (Math.hypot(t.x, t.z) >= CITY.middle || t.h <= CITY.middleCap));
  assert.ok(L.pulses.length > 0 && L.pulses.length <= CITY.maxPulses);
  assert.equal(L.beam?.partId, 'api');
  assert.equal(towerHeight(1e9, 1, 1), CITY.maxH);
  assert.equal(towerHeight(1e9, 0, 0), CITY.middleCap);
  assert.deepEqual(statusMoves(L.districts, L.districts.map((d) => ({ ...d, status: 'stuck' as const }))).map((m) => m.to), ['stuck', 'stuck']);
});
