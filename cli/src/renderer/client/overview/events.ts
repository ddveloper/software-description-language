declare const SDL: any;
import { OV, NODE_W, NODE_H, state, navigate } from '../state.js';
import { esc } from '../utils.js';
import { makeEdgePath, groupByDomain, getDomainBounds } from './layout.js';
import { switchOvSublayer } from './sublayer.js';

// ── Transform ─────────────────────────────────────────────────────────────────
export function applyOvTransform(): void {
  const world = document.getElementById('ov-world');
  if (world) world.setAttribute('transform',
    'translate(' + OV.panX + ',' + OV.panY + ') scale(' + OV.zoom + ')');
}

export function resetOvView(): void {
  const keys = Object.keys(OV.positions);
  if (!keys.length) { OV.zoom = 1; OV.panX = 40; OV.panY = 40; applyOvTransform(); return; }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  keys.forEach(id => {
    const p = OV.positions[id];
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + NODE_W); maxY = Math.max(maxY, p.y + NODE_H);
  });
  const wrap = document.getElementById('ov-wrap');
  const ww = wrap ? wrap.clientWidth : 800, wh = wrap ? wrap.clientHeight : 600;
  const cw = maxX - minX + 80, ch = maxY - minY + 80;
  OV.zoom = Math.min(1.5, Math.min(ww / cw, wh / ch));
  OV.panX = (ww - cw * OV.zoom) / 2 - minX * OV.zoom + 40;
  OV.panY = (wh - ch * OV.zoom) / 2 - minY * OV.zoom + 40;
  applyOvTransform();
}

// ── Edge updates ──────────────────────────────────────────────────────────────
export function updateEdgesForNode(id: string): void {
  document.querySelectorAll('#ov-edges path, #ov-flows path').forEach(el => {
    const e = el as HTMLElement;
    if (e.dataset.from !== id && e.dataset.to !== id) return;
    const fp = OV.positions[e.dataset.from!], tp = OV.positions[e.dataset.to!];
    if (fp && tp) el.setAttribute('d', makeEdgePath(fp, tp, !!el.closest('#ov-flows')));
  });
}

export function rebuildDomainRects(): void {
  const allSvcs = (SDL.platforms as any[]).flatMap(p => p.services || []);
  groupByDomain(allSvcs).forEach((svcs, domain) => {
    const b = getDomainBounds(svcs);
    const rect = document.querySelector('[data-domain="' + esc(domain) + '"]');
    const txt = document.querySelector('[data-domain-lbl="' + esc(domain) + '"]');
    if (rect) {
      rect.setAttribute('x', String(b.x)); rect.setAttribute('y', String(b.y));
      rect.setAttribute('width', String(b.w)); rect.setAttribute('height', String(b.h));
    }
    if (txt) { txt.setAttribute('x', String(b.x + 14)); txt.setAttribute('y', String(b.y + 18)); }
  });
}

// ── Zoom threshold ─────────────────────────────────────────────────────────────
export function findClosestNodeToCenter(wrap: HTMLElement): string | null {
  const ww = wrap.clientWidth, wh = wrap.clientHeight;
  const worldCX = (ww / 2 - OV.panX) / OV.zoom;
  const worldCY = (wh / 2 - OV.panY) / OV.zoom;
  let nearest: string | null = null, nearestDist = Infinity;
  const nodeW = OV.sublayer === 'micro' ? 200 : NODE_W;  // MICRO_W
  const nodeH = OV.sublayer === 'micro' ? 50 : NODE_H;   // MICRO_H
  Object.entries(OV.positions).forEach(([id, p]) => {
    const dist = Math.hypot((p.x + nodeW / 2) - worldCX, (p.y + nodeH / 2) - worldCY);
    if (dist < nearestDist) { nearestDist = dist; nearest = id; }
  });
  return nearest;
}

export function checkZoomThreshold(): void {
  clearTimeout(OV._zoomTimer as any);
  OV._zoomTimer = setTimeout(() => {
    const wrap = document.getElementById('ov-wrap') as HTMLElement | null;
    if (!wrap) return;
    if (state.layer !== 'overview') return;
    const wh = wrap.clientHeight;
    const keys = Object.keys(OV.positions);

    if (OV.sublayer === 'meso' && NODE_H * OV.zoom > wh * 0.5) {
      const nearest = findClosestNodeToCenter(wrap);
      if (nearest) { switchOvSublayer('micro', nearest); return; }
    }
    if (OV.sublayer === 'meso' && keys.length && (SDL.platforms as any[]).length) {
      let minY = Infinity, maxY = -Infinity;
      keys.forEach(id => { const p = OV.positions[id]; minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y + NODE_H); });
      if ((maxY - minY) * OV.zoom < wh * 0.25) { switchOvSublayer('macro'); return; }
    }
    if (OV.sublayer === 'micro' && 50 * OV.zoom < wh * 0.15) {  // MICRO_H
      switchOvSublayer('meso'); return;
    }
    if (OV.sublayer === 'macro' && 90 * OV.zoom > wh * 0.35) {  // MACRO_H
      switchOvSublayer('meso'); return;
    }
  }, 400) as any;
}

// ── Mouse/wheel events ────────────────────────────────────────────────────────
export function setupOvEvents(): void {
  const wrap = document.getElementById('ov-wrap');
  const bg = document.getElementById('ov-bg');
  if (!wrap || !bg) return;

  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const rect = wrap.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    OV.panX = mx - factor * (mx - OV.panX);
    OV.panY = my - factor * (my - OV.panY);
    OV.zoom = Math.max(0.1, Math.min(5, OV.zoom * factor));
    applyOvTransform();
    checkZoomThreshold();
  }, { passive: false });

  bg.addEventListener('mousedown', e => {
    e.preventDefault();
    OV.pan = { sx: e.clientX, sy: e.clientY, px: OV.panX, py: OV.panY };
    wrap.classList.add('panning');
  });

  if (!OV._ovReady) {
    OV._ovReady = true;
    document.addEventListener('mousemove', e => {
      if (OV.drag) {
        if (Math.abs(e.clientX - OV.drag.sx) > 3 || Math.abs(e.clientY - OV.drag.sy) > 3)
          OV.drag.moved = true;
        const nx = OV.drag.ox + (e.clientX - OV.drag.sx) / OV.zoom;
        const ny = OV.drag.oy + (e.clientY - OV.drag.sy) / OV.zoom;
        OV.positions[OV.drag.id] = { x: nx, y: ny };
        const node = document.querySelector('.ov-node[data-id="' + OV.drag.id + '"]');
        if (node) node.setAttribute('transform', 'translate(' + nx + ',' + ny + ')');
        updateEdgesForNode(OV.drag.id);
      } else if (OV.pan) {
        OV.panX = OV.pan.px + (e.clientX - OV.pan.sx);
        OV.panY = OV.pan.py + (e.clientY - OV.pan.sy);
        applyOvTransform();
      }
    });
    document.addEventListener('mouseup', () => {
      if (OV.drag) {
        const node = document.querySelector('.ov-node[data-id="' + OV.drag.id + '"]');
        if (node) node.classList.remove('dragging');
        if (!OV.drag.moved) {
          navigate({ layer: 'layer_logic', serviceId: OV.drag.id } as any);
        } else if (OV.sublayer !== 'micro') {
          rebuildDomainRects();
          persistOvLayout();
        }
        OV.drag = null;
      }
      if (OV.pan) {
        OV.pan = null;
        const w = document.getElementById('ov-wrap');
        if (w) w.classList.remove('panning');
        persistOvLayout();
      }
    });
  }
}

// ── Edge tooltips ─────────────────────────────────────────────────────────────
export function setupEdgeTooltips(): void {
  const tip = document.getElementById('ov-tip');
  if (!tip) return;
  const allSvcs = (SDL.platforms as any[]).flatMap(p => p.services || []);
  const svcById: Record<string, any> = {};
  allSvcs.forEach((s: any) => { svcById[s.id] = s; });
  document.querySelectorAll('.ov-edge-hit').forEach(el => {
    const e = el as HTMLElement;
    el.addEventListener('mouseenter', ev => {
      if (OV.playback.playing) return;
      const fromLabel = (svcById[e.dataset.from!] || {}).label || e.dataset.from;
      const toLabel = (svcById[e.dataset.to!] || {}).label || e.dataset.to;
      const labels = e.dataset.labels || '';
      const isFlow = e.dataset.type === 'flow';
      tip.innerHTML = `<strong>${esc(String(fromLabel))} → ${esc(String(toLabel))}</strong><br><span style="opacity:.75">${isFlow ? 'flow: ' : 'dep: '}${esc(labels)}</span>`;
      tip.style.display = 'block';
      tip.style.left = ((ev as MouseEvent).clientX + 14) + 'px';
      tip.style.top = ((ev as MouseEvent).clientY - 40) + 'px';
    });
    el.addEventListener('mousemove', ev => {
      if (tip.style.display !== 'none') {
        tip.style.left = ((ev as MouseEvent).clientX + 14) + 'px';
        tip.style.top = ((ev as MouseEvent).clientY - 40) + 'px';
      }
    });
    el.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
  });
}

// ── Persistence ───────────────────────────────────────────────────────────────
export function persistOvLayout(): void {
  // Always save meso positions regardless of current sublayer.
  // Micro positions are not persisted — they're recomputed from SDL data.
  const mesoPos = OV.sublayer === 'meso' ? OV.positions : OV._mesoPositions;
  try {
    localStorage.setItem('sdl-ov-layout', JSON.stringify({
      sdlLayoutVersion: 2, zoom: OV.zoom, panX: OV.panX, panY: OV.panY,
      positions: mesoPos, mesoPositions: mesoPos,
      macroPositions: OV._macroPositions, toggles: OV.toggles,
    }));
  } catch (e) { /* ignore */ }
}

