// playwright-core is borrowed from the agent-office checkout next door (no browser download needed).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const candidates = [
  process.env.PLAYWRIGHT_CORE,
  '/Users/zygimantasbagdzevicius/nortal/dark-factory/external-projects/agent-office/node_modules/playwright-core',
  'playwright-core',
].filter(Boolean);
let pw;
for (const c of candidates) { try { pw = require(c); break; } catch { /* next */ } }
if (!pw) throw new Error('playwright-core not found; set PLAYWRIGHT_CORE');
export const chromium = pw.chromium;
