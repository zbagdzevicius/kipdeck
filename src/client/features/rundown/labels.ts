// The holo city's words: a name plate over each of the biggest districts (8 at most), its status as a
// word and its name, and the next step on a dark plate at the table's lip on the conn's side, in the
// heading caption's style (features/life/heading.ts). The name plates are one draw: every plate is a
// row of one canvas, drawn as an instance of one quad that always faces the camera. Painted only when
// the rundown changes; a plate that would cover a wall board's face is shrunk to nothing (index.ts).
import * as THREE from 'three';
import { MISSION_TABLE } from '../../../shared/layout';
import type { Status } from '../../../shared/rundown/schema';
import { sharp } from '../../world/sharp';
import { ACCENT, STATUS_LIGHT } from './city';
import type { District } from './logic';

export const MAX_PLATES = 8;
const UI = (weight: number, size: number) => `${weight} ${size}px Archivo, system-ui, sans-serif`;
const MARK: Record<Status, string> = { done: 'DONE', 'in-progress': 'IN PROGRESS', 'not-started': 'NOT STARTED', stuck: 'STUCK' };
/** A plate's size on the deck (m), and its row in the atlas (px). */
const PLATE = { w: 0.86, h: 0.16, px: 512, py: 96 } as const;

const PLATE_VERT = /* glsl */ `
attribute vec2 aSize;
attribute float aRow;
uniform float uRows;
varying vec2 vUv;
void main() {
  // The quad's middle where the instance stands, its corners laid out in view space: it faces you.
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * aSize;
  gl_Position = projectionMatrix * mv;
  vUv = vec2(uv.x, (aRow + uv.y) / uRows);
}`;

const PLATE_FRAG = /* glsl */ `
uniform sampler2D uMap;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(uMap, vUv);
  if (c.a < 0.02) discard;
  gl_FragColor = c;
  #include <colorspace_fragment>
}`;

function fit(g: CanvasRenderingContext2D, text: string, max: number): string {
  let t = text;
  while (t.length > 3 && g.measureText(t).width > max) t = `${t.slice(0, -2).trimEnd()}.`;
  return t;
}

export interface Plate {
  /** In the city's space. */
  at: THREE.Vector3;
  w: number;
  h: number;
}

export interface CityLabels {
  group: THREE.Group;
  /** The name plates as they stand now. */
  plates(): readonly Plate[];
  /** Shows or stands down plate `i`. */
  show(i: number, on: boolean): void;
  set(districts: readonly District[], tops: Map<string, number>, step: string | null): void;
}

export function cityLabels(): CityLabels {
  const group = new THREE.Group();

  const atlas = document.createElement('canvas');
  atlas.width = PLATE.px;
  atlas.height = PLATE.py * MAX_PLATES;
  const ag = atlas.getContext('2d')!;
  const atlasTex = new THREE.CanvasTexture(atlas);
  atlasTex.colorSpace = THREE.SRGBColorSpace;
  const quad = new THREE.PlaneGeometry(1, 1);
  const size = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PLATES * 2), 2);
  const row = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PLATES), 1);
  quad.setAttribute('aSize', size);
  quad.setAttribute('aRow', row);
  const plateMat = new THREE.ShaderMaterial({ vertexShader: PLATE_VERT, fragmentShader: PLATE_FRAG, uniforms: { uMap: { value: atlasTex }, uRows: { value: MAX_PLATES } }, transparent: true, depthWrite: false });
  const names = new THREE.InstancedMesh(quad, plateMat, MAX_PLATES);
  names.count = 0;
  names.frustumCulled = false;
  names.renderOrder = 4;
  names.raycast = () => {};
  group.add(names);
  let plates: Plate[] = [];

  // The next step's plate: wide and low at the lip on the conn's side (+z), over the heading's caption.
  const canvas = document.createElement('canvas');
  canvas.width = 714;
  canvas.height = 84;
  const g = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  sharp(tex);
  const step = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, fog: false }));
  step.position.set(0, 0.46, MISSION_TABLE.r - 0.12);
  step.rotation.x = -0.25;
  step.renderOrder = 4;
  step.raycast = () => {};
  group.add(step);

  const m = new THREE.Matrix4();
  const paintRow = (i: number, d: District) => {
    const y = i * PLATE.py;
    ag.clearRect(0, y, PLATE.px, PLATE.py);
    ag.fillStyle = 'rgba(8,13,19,0.88)';
    ag.fillRect(0, y, PLATE.px, PLATE.py);
    ag.fillStyle = STATUS_LIGHT[d.status].color;
    ag.fillRect(0, y, 8, PLATE.py);
    ag.textBaseline = 'middle';
    ag.font = UI(700, 22);
    ag.fillText(MARK[d.status], 24, y + 30);
    ag.fillStyle = '#E8ECEF';
    ag.font = UI(700, 36);
    ag.fillText(fit(ag, d.name.toUpperCase(), 470), 24, y + 66);
  };

  return {
    group,
    plates: () => plates,
    show(i, on) {
      const p = plates[i];
      if (!p) return;
      const w = on ? p.w : 0;
      if (size.getX(i) === w) return;
      size.setXY(i, w, on ? p.h : 0);
      size.needsUpdate = true;
    },
    set(districts, tops, text) {
      const biggest = [...districts].sort((a, b) => b.w * b.d - a.w * a.d).slice(0, MAX_PLATES);
      ag.clearRect(0, 0, atlas.width, atlas.height);
      plates = biggest.map((d, i) => {
        paintRow(i, d);
        const at = new THREE.Vector3(d.x, (tops.get(d.id) ?? 0) + 0.14, d.z);
        m.makeTranslation(at.x, at.y, at.z);
        names.setMatrixAt(i, m);
        // The atlas's rows run top down; uv.y runs bottom up.
        row.setX(i, MAX_PLATES - 1 - i);
        size.setXY(i, PLATE.w, PLATE.h);
        return { at, w: PLATE.w, h: PLATE.h };
      });
      names.count = plates.length;
      names.instanceMatrix.needsUpdate = true;
      row.needsUpdate = true;
      size.needsUpdate = true;
      atlasTex.needsUpdate = true;
      step.visible = !!text;
      if (!text) return;
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.fillStyle = 'rgba(8,13,19,0.94)';
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.fillStyle = ACCENT;
      g.fillRect(0, 0, canvas.width, 5);
      g.textBaseline = 'middle';
      g.font = UI(700, 22);
      g.fillText('NEXT STEP', 18, 44);
      g.fillStyle = '#F4E3D6';
      g.font = UI(600, 28);
      g.fillText(fit(g, text, canvas.width - 180), 160, 45);
      tex.needsUpdate = true;
    },
  };
}
