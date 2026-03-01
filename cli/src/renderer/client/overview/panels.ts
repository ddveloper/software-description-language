declare const SDL: any;
import { OV } from '../state.js';
import { esc } from '../utils.js';
import { stopPlayback } from './playback.js';

// ── Micro view panels (Operations + Routing Steps) ───────────────────────────

export function buildMicroOpsPanel(): void {
  const hdr = document.getElementById('ov-left-panel-hdr');
  const list = document.getElementById('ov-flow-list');
  if (hdr) hdr.textContent = 'Operations';
  if (!list) return;
  const svc = (SDL.services as any[]).find(s => s.serviceId === OV.focusedSvc);
  if (!svc || !(svc.operations || []).length) {
    list.innerHTML = `<div style="padding:10px 12px;color:var(--muted);font-size:12px">No operations.</div>`;
    return;
  }
  list.innerHTML = svc.operations.map((op: any) => {
    const stepCount = (op.routing && op.routing.steps) ? op.routing.steps.length : 0;
    const isActive = OV.activeOperation === op.id;
    return `<div class="ov-flow-item${isActive ? ' active' : ''}" onclick="toggleActiveOperation('${esc(op.id)}')">
      <div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(String(op.label || op.id))}</div>
      <div style="color:var(--muted);font-size:10px">${stepCount} routing step${stepCount !== 1 ? 's' : ''}</div>
    </div>`;
  }).join('');
}

export function buildMicroRoutingStepsPanel(): void {
  const hdr = document.getElementById('ov-right-panel-hdr');
  const list = document.getElementById('ov-step-list');
  const btn = document.getElementById('ov-play-btn');
  if (hdr) hdr.textContent = 'Routing Steps';
  if (!list) return;
  const svc = (SDL.services as any[]).find(s => s.serviceId === OV.focusedSvc);
  const op = svc ? (svc.operations || []).find((o: any) => o.id === OV.activeOperation) : null;
  const steps: any[] = (op && op.routing && op.routing.steps) ? op.routing.steps : [];
  OV.playback.allSteps = steps.map((s: any) => ({
    step: Object.assign({}, s, {
      from_service: 'op:' + OV.activeOperation,
      to_service: s.dependency_ref ? 'dep:' + s.dependency_ref : null,
    }),
  }));
  if (!steps.length) {
    const msg = OV.activeOperation ? 'No routing steps for this operation.' : 'Select an operation to see routing steps.';
    list.innerHTML = `<div style="padding:10px 12px;color:var(--muted);font-size:12px">${msg}</div>`;
    if (btn) { (btn as HTMLButtonElement).disabled = true; btn.textContent = '▶ Play'; }
    return;
  }
  list.innerHTML = steps.map((s: any, i: number) =>
    `<div class="ov-step-item" data-step="${i}">
      <div style="display:flex;gap:6px;align-items:baseline">
        <span style="font-weight:700;color:var(--accent);min-width:22px;font-size:11px">${esc(String(s.id || i + 1))}</span>
        <span style="font-weight:500;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(String(s.action || s.label || ''))}</span>
      </div>
      ${s.dependency_ref ? `<div style="color:var(--muted);font-size:10px;margin-top:2px">→ ${esc(String(s.dependency_ref))}</div>` : ''}
    </div>`
  ).join('');
  if (btn) { (btn as HTMLButtonElement).disabled = false; btn.textContent = OV.playback.playing ? '⏸ Pause' : '▶ Play'; }
}

export function toggleActiveOperation(opId: string): void {
  OV.activeOperation = OV.activeOperation === opId ? null : opId;
  if (OV.playback.playing) stopPlayback();
  buildMicroOpsPanel();
  buildMicroRoutingStepsPanel();
}

// ── Meso view panels (Flows + Active Steps) ──────────────────────────────────

export function buildFlowsPanel(): void {
  const hdr = document.getElementById('ov-left-panel-hdr');
  if (hdr) hdr.textContent = 'Flows';
  const list = document.getElementById('ov-flow-list');
  if (!list) return;
  const allFlows = (SDL.serviceFlowBundles as any[]).flatMap(b => b.flows);
  if (!allFlows.length) {
    list.innerHTML = '<div style="padding:10px 12px;color:var(--muted);font-size:12px">No flows defined.</div>';
    return;
  }
  list.innerHTML = allFlows.map((f: any) =>
    `<div class="ov-flow-item${OV.activeFlows.has(f.id) ? ' active' : ''}" data-fid="${f.id}" onclick="toggleActiveFlow('${f.id}')">
      <div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(String(f.label || f.id))}</div>
      <div style="color:var(--muted);font-size:10px">${(f.steps || []).length} steps</div>
    </div>`
  ).join('');
}

export function toggleActiveFlow(flowId: string): void {
  if (OV.activeFlows.has(flowId)) OV.activeFlows.clear();
  else { OV.activeFlows.clear(); OV.activeFlows.add(flowId); }
  if (OV.playback.playing) stopPlayback();
  buildFlowsPanel();
  updateStepsPanel();
}

export function flattenActiveSteps(): any[] {
  const result: any[] = [];
  (SDL.serviceFlowBundles as any[]).forEach(b => {
    b.flows.forEach((f: any) => {
      if (!OV.activeFlows.has(f.id)) return;
      (f.steps || []).forEach((step: any, idx: number) => result.push({ flowId: f.id, stepIdx: idx, step }));
    });
  });
  return result;
}

export function updateStepsPanel(): void {
  const hdr = document.getElementById('ov-right-panel-hdr');
  if (hdr) hdr.textContent = 'Active Steps';
  const list = document.getElementById('ov-step-list');
  if (!list) return;
  const steps = flattenActiveSteps();
  OV.playback.allSteps = steps;
  const btn = document.getElementById('ov-play-btn');
  if (!steps.length) {
    list.innerHTML = '<div style="padding:10px 12px;color:var(--muted);font-size:12px">Select a flow to see steps.</div>';
    if (btn) { (btn as HTMLButtonElement).disabled = true; btn.textContent = '▶ Play'; }
    return;
  }
  list.innerHTML = steps.map((s: any, i: number) =>
    `<div class="ov-step-item" data-step="${i}">
      <div style="display:flex;gap:6px;align-items:baseline">
        <span style="font-weight:700;color:var(--accent);min-width:22px;font-size:11px">${s.step.id || i + 1}</span>
        <span style="font-weight:500;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(String(s.step.label || ''))}</span>
      </div>
      <div style="color:var(--muted);font-size:10px;margin-top:2px">${esc(String(s.step.from_service || ''))} → ${esc(String(s.step.to_service || ''))}</div>
    </div>`
  ).join('');
  if (btn) { (btn as HTMLButtonElement).disabled = false; btn.textContent = OV.playback.playing ? '⏸ Pause' : '▶ Play'; }
}
