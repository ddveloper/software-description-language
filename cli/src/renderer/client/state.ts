// SDL is injected into the page by html-renderer.ts as `const SDL = ${JSON.stringify(data)};`
// It is a browser global — each module that needs it uses `declare const SDL: any`.
// DO NOT import or export SDL from here.

// ── App state ─────────────────────────────────────────────────────────────────
export const state: {
  layer: string;
  platformIdx: number;
  flowBundleIdx: number;
  serviceId: string | null;
  operationId: string | null;
  perspective: string;
} = {
  layer: 'platform',
  platformIdx: 0,
  flowBundleIdx: 0,
  serviceId: null,
  operationId: null,
  perspective: 'business',
};

// ── Overview state ─────────────────────────────────────────────────────────────
export const OV: {
  zoom: number;
  panX: number;
  panY: number;
  positions: Record<string, { x: number; y: number }>;
  toggles: Record<string, boolean>;
  drag: { id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null;
  pan: { sx: number; sy: number; px: number; py: number } | null;
  activeFlows: Set<string>;
  playback: { playing: boolean; stepIdx: number; repeat: boolean; speed: number; timer: ReturnType<typeof setInterval> | null; allSteps: any[] };
  sublayer: string;
  focusedSvc: string | null;
  activeOperation: string | null;
  _mesoPositions: Record<string, { x: number; y: number }>;
  _macroPositions: Record<string, { x: number; y: number }>;
  _zoomTimer: ReturnType<typeof setTimeout> | null;
  _ovReady: boolean;
} = {
  zoom: 1, panX: 40, panY: 40,
  positions: {},
  toggles: { domains: true, connections: true, kinds: true, tags: false, flows: true },
  drag: null,
  pan: null,
  activeFlows: new Set(),
  playback: { playing: false, stepIdx: 0, repeat: false, speed: 1000, timer: null, allSteps: [] },
  sublayer: 'meso',
  focusedSvc: null,
  activeOperation: null,
  _mesoPositions: {},
  _macroPositions: {},
  _zoomTimer: null,
  _ovReady: false,
};

// ── Node size constants ────────────────────────────────────────────────────────
export const NODE_W = 160;
export const NODE_H = 64;
export const MACRO_W = 240;
export const MACRO_H = 90;
export const MICRO_W = 200;
export const MICRO_H = 50;

// ── Navigate — late-bound to avoid circular deps ───────────────────────────────
// The real implementation is set by main.ts via setNavigateImpl.
let _navigateImpl: ((patch: Partial<typeof state>) => void) = () => {};
export function navigate(patch: Partial<typeof state>) { _navigateImpl(patch); }
export function setNavigateImpl(fn: (patch: Partial<typeof state>) => void) { _navigateImpl = fn; }
