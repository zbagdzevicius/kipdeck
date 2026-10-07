// The holo city's layout as plain numbers the tests run (nothing here draws): a district per part, laid
// out by the same squarified treemap as the page and the window, up to six towers in each for its
// biggest folders, a pulse for each recent commit up the towers of the parts it touched, a ring per
// milestone round the table's rim, and where the next step's beam rises. All in the table's own space:
// its middle at its top, x and z across, y up, in metres.

import { partFolders } from '../../../shared/rundown/html-sections';
import type { Rundown, Status } from '../../../shared/rundown/schema';
import { inset, squarify, withFloor } from '../../../shared/rundown/treemap';

/** The city: a square this wide on the tabletop, towers no taller than this, the middle kept low for the course column. */
export const CITY = { size: 2.6, maxH: 0.9, minH: 0.08, perDecade: 0.22, middle: 0.5, middleCap: 0.3, towersPer: 6, maxTowers: 256, maxPulses: 64, pulseDays: 7 } as const;
/** The milestone rings at the table's rim, outside the heading's progress ring (features/life/heading.ts). */
export const RINGS = { inner: 2.8, outer: 3.1, width: 0.035 } as const;

export interface District {
  id: string;
  name: string;
  status: Status;
  x: number;
  z: number;
  w: number;
  d: number;
  /** Uncommitted changes in it: it shimmers. */
  dirty: boolean;
}

export interface Tower {
  partId: string;
  status: Status;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

export interface Pulse {
  /** The tower it climbs. */
  tower: number;
  /** 0..1: newer commits pulse brighter. */
  bright: number;
  /** 0..1: where in its climb it starts, so pulses don't march in step. */
  phase: number;
}

export interface Ring {
  radius: number;
  state: 'done' | 'active' | 'ahead';
  /** Of an active one: how much of it is done, 0..1. */
  progress: number;
}

export interface CityLayout {
  districts: District[];
  towers: Tower[];
  pulses: Pulse[];
  rings: Ring[];
  /** The district the next step points at. */
  beam: { x: number; z: number; partId: string } | null;
}

/** How tall a tower of `lines` stands: a log scale, capped, and low near the middle. */
export function towerHeight(lines: number, x: number, z: number): number {
  const h = Math.min(CITY.maxH, CITY.minH + CITY.perDecade * Math.log10(Math.max(1, lines)));
  return Math.hypot(x, z) < CITY.middle ? Math.min(h, CITY.middleCap) : h;
}

export function cityLayout(r: Rundown, now: Date): CityLayout {
  const half = CITY.size / 2;
  const floored = withFloor(r.parts.map((p) => p.metrics.lines), 0.02);
  const tiles = squarify(r.parts.map((p, i) => ({ p, v: floored[i] })), (x) => x.v, { x: -half, y: -half, w: CITY.size, h: CITY.size });
  const districts: District[] = [];
  const towers: Tower[] = [];
  const firstTower = new Map<string, number[]>();
  for (const { item, ...t } of tiles) {
    const p = item.p;
    const box = inset(t, 0.03);
    districts.push({ id: p.id, name: p.name, status: p.status, x: box.x + box.w / 2, z: box.y + box.h / 2, w: box.w, d: box.h, dirty: p.metrics.uncommitted > 0 });
    const folders = partFolders(r, p).slice(0, CITY.towersPer);
    const inner = inset(box, Math.min(box.w, box.h) * 0.08);
    const cells = folders.length ? squarify(folders, (f) => f.lines, inner) : [{ item: { path: p.id, lines: p.metrics.lines }, ...inner }];
    const mine: number[] = [];
    for (const c of cells) {
      if (towers.length >= CITY.maxTowers) break;
      const x = c.x + c.w / 2;
      const z = c.y + c.h / 2;
      mine.push(towers.length);
      towers.push({ partId: p.id, status: p.status, x, z, w: Math.max(0.02, c.w * 0.72), d: Math.max(0.02, c.h * 0.72), h: towerHeight(c.item.lines, x, z) });
    }
    firstTower.set(p.id, mine);
  }
  const pulses: Pulse[] = [];
  const recent = (r.facts.git?.recentCommits ?? []).filter((c) => now.getTime() - Date.parse(c.date) < CITY.pulseDays * 86_400_000);
  recent.forEach((c, i) => {
    const age = (now.getTime() - Date.parse(c.date)) / (CITY.pulseDays * 86_400_000);
    for (const id of c.parts) {
      for (const tower of (firstTower.get(id) ?? []).slice(0, 2)) {
        if (pulses.length < CITY.maxPulses) pulses.push({ tower, bright: Math.max(0.25, 1 - age), phase: (i * 0.37 + tower * 0.13) % 1 });
      }
    }
  });
  const n = r.milestones.length;
  const rings: Ring[] = r.milestones.slice(0, 6).map((m, i) => {
    const done = m.items.filter((it) => it.done).length;
    return { radius: n <= 1 ? (RINGS.inner + RINGS.outer) / 2 : RINGS.inner + ((RINGS.outer - RINGS.inner) * i) / Math.min(5, n - 1), state: m.state, progress: m.items.length ? done / m.items.length : 0 };
  });
  const target = r.nextStep?.partId ? districts.find((d) => d.id === r.nextStep!.partId) : undefined;
  return { districts, towers, pulses, rings, beam: target ? { x: target.x, z: target.z, partId: target.id } : null };
}

/** What changed between two layouts that a sound marks: parts whose status moved. */
export function statusMoves(before: readonly District[], after: readonly District[]): { id: string; from: Status; to: Status }[] {
  const was = new Map(before.map((d) => [d.id, d.status]));
  return after.flatMap((d) => {
    const from = was.get(d.id);
    return from && from !== d.status ? [{ id: d.id, from, to: d.status }] : [];
  });
}

/** The words under the crosshair at a district: "E  core - in progress". */
export const STATUS_WORDS: Record<Status, string> = { done: 'done', 'in-progress': 'in progress', 'not-started': 'not started', stuck: 'stuck' };
