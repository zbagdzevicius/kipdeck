/**
 * Rundown on the bridge (Labs > Rundown): the deck's project as a city of light over the mission table.
 * A district per part, sized by its code and lit by its status, towers for its biggest folders, a pulse
 * up them for each commit this week, the milestones as rings round the rim, and an orange beam where
 * the next step is. Brought up from the menu, Ctrl+K or the Rundown window; the star map stands down
 * while it's up (Holo.yieldTo). E at a district opens the Rundown window at that part, and its close
 * or Esc puts you straight back into mouse-look. Follows the deck you're on; draws nothing while it's
 * down or the tab is hidden; reduced motion or Ship motion Off holds it still, Low quality drops the pulses.
 */
import * as THREE from 'three';
import type { Ctx } from '../../core/context';
import { aside, hintTitle, key, onE } from '../../core/hint';
import type { Parts } from '../../core/parts';
import { store } from '../../state';
import { saveSettings } from '../../state/persist';
import { toast } from '../../ui/dom';
import type { HudAction } from '../../ui/menu';
import type { PaletteEntry } from '../../ui/palette';
import { overlaps } from '../bridge/holo-route';
import { cityLayout, STATUS_WORDS, statusMoves, type District } from './logic';
import { statusChime } from './sound';
import type { RundownHolo } from './world';

declare module '../../world/types' {
  interface InteractKinds {
    rundown: true;
  }
}

export type RundownParts = Pick<Parts, 'quality' | 'settings' | 'boardFaces' | 'stage'>;

/** How fast the city comes up and goes down (per second). */
const FADE = 2.2;
/** How often the plates are checked against the wall boards (ms). */
const PLATES_EVERY = 100;

export function installRundown(ctx: Ctx, parts: RundownParts) {
  const holo: RundownHolo = ctx.office.rundownHolo;
  const { city, labels, root } = holo;
  let k = 0;
  let t = 0;
  let drawnKey = '';
  let districts: District[] = [];
  let usable: ReturnType<RundownHolo['standIns']> = [];
  let watching: string | null = null;

  const wanted = () => parts.settings.rundownHolo && store.lab('rundown');

  /** Watch the deck you're on while the city is up (the Rundown window watches whichever it shows). */
  async function syncWatch() {
    const floor = wanted() ? store.floor : null;
    if (floor === watching) return;
    const win = (await import('../../ui/rundown')).rundownWindow();
    if (win) return;
    watching = floor;
    ctx.net.send(floor ? { t: 'rundown.watch', floor } : { t: 'rundown.unwatch' });
  }

  function rebuild() {
    const view = store.rundowns.get(store.floor ?? '');
    const r = view?.rundown;
    if (!r) return;
    const k2 = `${r.generatedAt}|${r.project.head?.sha}|${r.parts.map((p) => p.status).join()}`;
    if (k2 === drawnKey) return;
    const layout = cityLayout(r, new Date());
    const moved = drawnKey ? statusMoves(districts, layout.districts) : [];
    drawnKey = k2;
    districts = layout.districts;
    city.build(layout);
    const tops = city.tops();
    labels.set(layout.districts, tops, r.nextStep?.text ?? null);
    usable = holo.standIns(layout.districts, tops);
    if (moved.length && k > 0.5) ctx.sound.play('rundown-status', 'ship', statusChime(moved.some((m) => m.to === 'stuck')));
  }

  function setUp(on: boolean) {
    if (on && !store.lab('rundown')) return toast('Rundown is a lab: an admin turns it on in Labs', 'warn');
    parts.settings.rundownHolo = on;
    saveSettings(parts.settings);
    void syncWatch();
    if (on) rebuild();
  }

  /** The Rundown window, on this deck (and at a part). */
  function openWindow(part?: string) {
    void import('../../ui/rundown').then((m) =>
      m.openRundown(ctx.net, {
        floor: store.floor ?? undefined,
        part,
        // The window watched what it showed; the city goes back to watching its own deck.
        onClose: () => {
          watching = null;
          void syncWatch();
        },
      }),
    );
  }

  store.on('rundown', rebuild);
  store.on('floor', () => {
    drawnKey = '';
    void syncWatch();
    rebuild();
  });
  store.on('labs', () => void syncWatch());

  ctx.usables.add({ usable: () => (k > 0.5 ? usable : []) });
  ctx.interactions.define('rundown', {
    reach: 7,
    hint: (it) => {
      const d = districts.find((x) => x.id === (it as (typeof usable)[number]).partId);
      return { k: `rundown|${d?.id}|${d?.status}`, parts: [hintTitle(d?.name ?? 'Part'), aside(d ? STATUS_WORDS[d.status] : ''), key('E', 'Rundown')] };
    },
    use: onE((it) => openWindow((it as (typeof usable)[number]).partId)),
  });

  // The plates stand down while they'd cover a wall board's face (as the holo's waypoint plates do).
  const c = new THREE.Vector3();
  const right = new THREE.Vector3();
  const p0 = new THREE.Vector3();
  const p1 = new THREE.Vector3();
  let platesAt = -Infinity;
  ctx.ticks.add('hud', ({ now }) => {
    if (k <= 0 || now - platesAt < PLATES_EVERY) return;
    platesAt = now;
    const faces = parts.boardFaces?.faces().flatMap((f) => (f.px ? [f.px] : [])) ?? [];
    const camera = parts.stage.view ?? ctx.camera;
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    const W = window.innerWidth;
    const H = window.innerHeight;
    labels.plates().forEach((pl, i) => {
      root.localToWorld(c.copy(pl.at));
      p0.copy(c).project(camera);
      if (p0.z > 1) return;
      p1.copy(c).addScaledVector(right, pl.w).project(camera);
      const half = (Math.abs(p1.x - p0.x) / 4) * W;
      const x = ((p0.x + 1) / 2) * W;
      const y = ((1 - p0.y) / 2) * H;
      const hh = (half * pl.h) / pl.w;
      labels.show(i, !overlaps({ left: x - half, right: x + half, top: y - hh, bottom: y + hh }, faces));
    });
  });

  ctx.ticks.add('world', ({ dt }) => {
    const target = wanted() ? 1 : 0;
    if (k === target && k === 0) return;
    if (document.visibilityState === 'hidden') return;
    k = target > k ? Math.min(target, k + dt * FADE) : Math.max(target, k - dt * FADE);
    ctx.office.holo.yieldTo(k);
    root.visible = k > 0.001;
    const still = ctx.reduceMotion.matches;
    if (!still) t += dt;
    city.frame(t, k, !still, !still && parts.quality.tier() !== 'low');
  });

  void syncWatch();
  return {
    /** Whether the city is up (or on its way up). */
    up: () => wanted(),
    toggle: () => setUp(!parts.settings.rundownHolo),
    openWindow,
  };
}

export type RundownApi = ReturnType<typeof installRundown>;

/** The bridge menu's rows (Tab): the Rundown window, and the city on the holo. */
export function rundownMenuActions(api: () => RundownApi | undefined): HudAction[] {
  return [
    { id: 'rundown', icon: 'overview', label: 'Rundown', section: 'Command', lab: 'rundown', title: () => "This deck's project: its parts, milestones, activity and decisions", run: () => api()?.openWindow() },
    { id: 'rundown-holo', icon: 'plot', label: 'Rundown on the holo', section: 'Command', lab: 'rundown', on: () => !!api()?.up(), title: () => "The project's map as a city of light over the mission table", run: () => api()?.toggle() },
  ];
}

/** Ctrl+K's entries for it, while the lab is on. */
export function rundownPaletteEntries(api: RundownApi | undefined): PaletteEntry[] {
  if (!api || !store.lab('rundown')) return [];
  return [
    { icon: 'overview', kind: 'Action', title: 'Rundown', detail: "This deck's parts, milestones and decisions", keywords: ['project map', 'status', 'milestones'], open: () => api.openWindow() },
    { icon: 'plot', kind: 'Action', title: api.up() ? 'Rundown off the holo' : 'Rundown on the holo', detail: 'The project as a city over the mission table', keywords: ['project map', 'holo', 'city'], open: () => api.toggle() },
  ];
}
