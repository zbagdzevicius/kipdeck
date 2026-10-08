// Every page's wordmark says the product's name: none still spells the old one in its two-tone markup.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const PAGES = ['src/client/bridge.html', 'src/client/login.html', 'src/client/join.html', 'src/client/claim.html', 'src/client/showcase/index.html', 'src/server/showcase/off.ts'];

test('the wordmark reads KIPDECK on the bridge, its loading screen, the sign-in pages and the showcase', () => {
  for (const f of PAGES) {
    const src = readFileSync(path.join(root, f), 'utf8');
    assert.doesNotMatch(src, /MERGE(?:<\/b>)?<span>LINE/, `${f} still spells the old name`);
    assert.match(src, /KIP(?:<\/b>)?<span>DECK<\/span>/, `${f} has no KIPDECK wordmark`);
  }
});
