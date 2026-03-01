declare const SDL: any;
import { OV, NODE_W, NODE_H, MACRO_W, MACRO_H, MICRO_W, MICRO_H } from '../state.js';
import { buildOvDomains, buildOvEdges, buildOvFlows, buildOvNodes, buildMacroContent, buildMicroContent } from './build.js';
import { buildFlowsPanel, updateStepsPanel, buildMicroOpsPanel, buildMicroRoutingStepsPanel } from './panels.js';
import { applyOvTransform, resetOvView, setupEdgeTooltips } from './events.js';
import { applyOvToggles, updateOvSublayerUI } from './ui.js';
import { stopPlayback } from './playback.js';

export function switchOvSublayer(sub: string, focusedId?: string): void {
  if (sub === OV.sublayer && focusedId === OV.focusedSvc) return;
  const wrap = document.getElementById('ov-wrap');
  if (!wrap) return;
  wrap.style.opacity = '0';
  setTimeout(() => {
    const allSvcs = (SDL.platforms as any[]).flatMap(p => p.services || []);
    if (OV.sublayer === 'meso' && sub !== 'meso') {
      OV._mesoPositions = Object.assign({}, OV.positions);
    }
    if (sub === 'macro') {
      if (Object.keys(OV._macroPositions).length) {
        OV.positions = Object.assign({}, OV._macroPositions);
      } else {
        OV.positions = computeMacroLayout();
        OV._macroPositions = Object.assign({}, OV.positions);
      }
    } else if (sub === 'micro') {
      OV.positions = computeMicroLayout(focusedId ?? null);
    } else {
      OV.positions = Object.keys(OV._mesoPositions).length
        ? Object.assign({}, OV._mesoPositions)
        : OV.positions;
    }
    const prevFocusedId = OV.focusedSvc;
    if (OV.sublayer === 'micro') { OV.activeOperation = null; if (OV.playback.playing) stopPlayback(); }
    OV.sublayer = sub;
    OV.focusedSvc = focusedId ?? null;
    buildOvContentInner(allSvcs);
    initLayoutForSublayer(sub, sub === 'meso' ? prevFocusedId : (focusedId ?? null), allSvcs);
    applyOvTransform();
    updateOvSublayerUI();
    wrap.style.opacity = '1';
  }, 360);
}

export function initLayoutForSublayer(sub: string, focusedId: string | null, _allSvcs: any[]): void {
  const wrap = document.getElementById('ov-wrap');
  if (!wrap) return;
  if (sub === 'macro') {
    const ww = wrap.clientWidth, wh = wrap.clientHeight;
    const n = (SDL.platforms as any[]).length || 1;
    const totalW = n * MACRO_W + (n - 1) * 80;
    OV.zoom = Math.min(1, (ww - 80) / totalW);
    OV.panX = (ww - totalW * OV.zoom) / 2;
    OV.panY = (wh - MACRO_H * OV.zoom) / 2;
  } else if (sub === 'micro') {
    resetOvView();
  } else {
    resetOvView();
    if (focusedId && OV.positions[focusedId]) {
      const ww = wrap.clientWidth, wh = wrap.clientHeight;
      const p = OV.positions[focusedId];
      OV.panX = ww / 2 - (p.x + NODE_W / 2) * OV.zoom;
      OV.panY = wh / 2 - (p.y + NODE_H / 2) * OV.zoom;
    }
  }
}

export function computeMacroLayout(): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  (SDL.platforms as any[]).forEach((p, i) => {
    positions[p.id || String(i)] = { x: i * (MACRO_W + 80), y: 0 };
  });
  return positions;
}

export function computeMicroLayout(svcId: string | null): Record<string, { x: number; y: number }> {
  const svc = (SDL.services as any[]).find(s => s.serviceId === svcId);
  const positions: Record<string, { x: number; y: number }> = {};
  if (!svc) return positions;
  const eps: any[] = svc.entryPoints || [];
  const ops: any[] = svc.operations || [];
  const deps: any[] = svc.dependencies || [];
  eps.forEach((ep: any, i: number) => { positions['ep:' + ep.id] = { x: 40, y: 40 + i * 80 }; });
  ops.forEach((op: any, i: number) => { positions['op:' + op.id] = { x: 300, y: 40 + i * 80 }; });
  deps.forEach((d: any, i: number) => { positions['dep:' + d.id] = { x: 560, y: 40 + i * 80 }; });
  return positions;
}

// Internal helper — avoids re-importing buildOvContent from index (which imports us)
function buildOvContentInner(allSvcs: any[]): void {
  if (OV.sublayer === 'macro') buildMacroContent();
  else if (OV.sublayer === 'micro') buildMicroContent(OV.focusedSvc);
  else {
    buildOvDomains(allSvcs);
    buildOvEdges(allSvcs);
    buildOvFlows();
    buildOvNodes(allSvcs);
  }
  if (OV.sublayer === 'micro') {
    buildMicroOpsPanel();
    buildMicroRoutingStepsPanel();
  } else {
    buildFlowsPanel();
    updateStepsPanel();
  }
  setupEdgeTooltips();
  applyOvToggles();
}
