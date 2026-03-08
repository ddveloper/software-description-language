declare const SDL: any;
import { OV } from '../state.js';
import { initOvLayout } from './layout.js';
import { buildOvDomains, buildOvEdges, buildOvFlows, buildOvNodes, buildMacroContent, buildMicroContent } from './build.js';
import { buildFlowsPanel, updateStepsPanel, buildMicroOpsPanel, buildMicroRoutingStepsPanel } from './panels.js';
import { setupOvEvents, applyOvTransform, resetOvView, setupEdgeTooltips } from './events.js';
import { applyOvToggles, updateOvSublayerUI } from './ui.js';

export function renderOverview(): void {
  const allSvcs = (SDL.platforms as any[]).flatMap(p => p.services || []);
  let hadSavedLayout = false;
  if (Object.keys(OV.positions).length === 0) {
    try {
      const saved = localStorage.getItem('sdl-ov-layout');
      if (saved) {
        const l = JSON.parse(saved);
        if (l.sdlLayoutVersion >= 1) {
          OV.zoom = l.zoom || 1; OV.panX = l.panX || 40; OV.panY = l.panY || 40;
          const meso = l.mesoPositions || l.positions || {};
          Object.assign(OV.positions, meso);
          Object.assign(OV._mesoPositions, meso);
          Object.assign(OV._macroPositions, l.macroPositions || {});
          Object.assign(OV.toggles, l.toggles || {});
          hadSavedLayout = true;
        }
      }
    } catch (e) { /* ignore */ }
    if (Object.keys(OV.positions).length === 0 && allSvcs.length) initOvLayout(allSvcs);
  } else {
    hadSavedLayout = true;
  }
  // If positions were loaded (e.g. from localStorage) but none match any current service
  // (stale layout — can happen when micro positions were saved), clear and reinitialize.
  if (allSvcs.length && !allSvcs.some((s: any) => OV.positions[s.id])) {
    Object.keys(OV.positions).forEach(k => delete OV.positions[k]);
    initOvLayout(allSvcs);
    hadSavedLayout = false;
  }
  document.getElementById('main')!.innerHTML = ovHtml();
  buildOvContent(allSvcs);
  setupOvEvents();
  // On first render (no saved layout), auto-fit all nodes in the viewport.
  // Otherwise restore the saved transform.
  if (!hadSavedLayout) resetOvView();
  else applyOvTransform();
  updateOvSublayerUI();
}

export function ovHtml(): string {
  const togs: [string, string, string][] = [
    ['domains', 'Domains', 'D'], ['connections', 'Connections', 'C'],
    ['kinds', 'Kinds', 'K'], ['tags', 'Tags', 'T'], ['flows', 'Flows', 'F'],
  ];
  const btns = togs.map(([k, l, h]) =>
    `<button id="tb-${k}" class="tog-btn${OV.toggles[k] ? ' on' : ''}" onclick="togOv('${k}')">${l} <kbd>${h}</kbd></button>`
  ).join('');
  const spd = OV.playback.speed;
  return `<div id="ov-toolbar">${btns}
    <span style="flex:1"></span>
    <button class="tog-btn" onclick="resetOvView()">Fit <kbd>R</kbd></button>
    <button class="tog-btn" onclick="saveOvLayout()">Save Layout</button>
    <label class="tog-btn" style="cursor:pointer">Load Layout<input type="file" accept=".json" style="display:none" onchange="loadOvLayout(event)"></label>
    <div id="ov-sublayer-crumb" style="margin-left:8px;font-size:12px;color:var(--muted);padding:0 6px;display:flex;align-items:center"></div>
    <button id="ov-back-btn" onclick="switchOvSublayer('meso')" style="display:none;padding:4px 10px;font-size:12px;border:1px solid var(--border);border-radius:5px;cursor:pointer;background:var(--surface);color:var(--text)">← Services</button>
  </div>
  <div id="ov-body">
    <div id="ov-flows-panel">
      <div id="ov-left-panel-hdr" style="padding:8px 12px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);border-bottom:1px solid var(--border)">Flows</div>
      <div id="ov-flow-list"></div>
    </div>
    <div id="ov-wrap"><svg id="ov-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="ov-arr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#94a3b8"/></marker>
        <marker id="ov-arr-b" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#93c5fd"/></marker>
        <marker id="ov-arr-micro" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto"><path d="M0,0 L0,5 L7,2.5 z" fill="#94a3b8"/></marker>
        <marker id="ov-arr-dep" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto"><path d="M0,0 L0,5 L7,2.5 z" fill="#fbbf24"/></marker>
      </defs>
      <rect id="ov-bg" x="-9999" y="-9999" width="19998" height="19998" fill="transparent"/>
      <g id="ov-world"><g id="ov-domains"></g><g id="ov-edges"></g><g id="ov-flows"></g><g id="ov-nodes"></g></g>
    </svg></div>
    <div id="ov-steps-panel">
      <div id="ov-right-panel-hdr" style="padding:8px 12px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);border-bottom:1px solid var(--border)">Active Steps</div>
      <div id="ov-step-list"></div>
      <div id="ov-playback-ctrl">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <button id="ov-play-btn" class="tog-btn" onclick="togglePlayback()" style="flex:1;justify-content:center" disabled>▶ Play</button>
          <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer;white-space:nowrap"><input type="checkbox" id="ov-repeat-chk" onchange="OV.playback.repeat=this.checked"> Repeat</label>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:11px;color:var(--muted)">Speed</span>
          <input type="range" id="ov-speed" min="200" max="3000" step="100" value="${spd}" oninput="setPlaybackSpeed(this.value)" style="flex:1;height:4px">
          <span id="ov-speed-lbl" style="font-size:11px;color:var(--muted);min-width:40px">${spd}ms</span>
        </div>
      </div>
    </div>
  </div>
  <div id="ov-tip"></div>`;
}

export function buildOvContent(allSvcs: any[]): void {
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
