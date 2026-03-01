/**
 * Generates a single self-contained HTML file for the SDL Interactive Renderer.
 *
 * The output is a zero-dependency* static HTML file that renders all three SDL layers:
 *   layer_platform → service dependency graph
 *   layer_service  → cross-service flow diagrams
 *   layer_logic    → service internals with perspective toggle
 *
 * *Mermaid.js is loaded from jsDelivr CDN for diagram rendering.
 */

import type { RenderData } from './reader.js';

export function generateHtml(data: RenderData, title?: string): string {
  const pageTitle = title ?? deriveTile(data);
  const serialized = JSON.stringify(data);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(pageTitle)} — SDL Renderer</title>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #f8f9fa; --surface: #fff; --border: #e2e8f0; --muted: #64748b;
  --accent: #3b82f6; --accent-dim: #dbeafe; --text: #1e293b;
  --green: #16a34a; --green-dim: #dcfce7;
  --amber: #d97706; --amber-dim: #fef3c7;
  --red: #dc2626; --red-dim: #fee2e2;
  --radius: 8px; --shadow: 0 1px 3px rgba(0,0,0,.08);
}
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 14px; line-height: 1.5; color: var(--text); background: var(--bg); }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
code { font-family: 'SF Mono', 'Cascadia Code', monospace; font-size: 12px;
  background: var(--border); padding: 1px 5px; border-radius: 3px; }

/* Layout */
#shell { display: flex; flex-direction: column; min-height: 100vh; }
#topbar { background: var(--surface); border-bottom: 1px solid var(--border);
  padding: 0 24px; display: flex; align-items: center; gap: 24px; height: 52px;
  position: sticky; top: 0; z-index: 10; }
#topbar h1 { font-size: 15px; font-weight: 600; }
#layer-tabs { display: flex; gap: 0; }
.tab { padding: 0 16px; height: 52px; display: flex; align-items: center;
  cursor: pointer; border-bottom: 2px solid transparent; color: var(--muted);
  font-size: 13px; font-weight: 500; transition: color .15s; }
.tab:hover { color: var(--text); }
.tab.active { color: var(--accent); border-bottom-color: var(--accent); }
#breadcrumb { font-size: 12px; color: var(--muted); display: flex; align-items: center; gap: 6px; }
.crumb { cursor: pointer; color: var(--accent); }
.crumb:hover { text-decoration: underline; }
#main { flex: 1; padding: 24px; max-width: 1100px; margin: 0 auto; width: 100%; }

/* Cards */
.card { background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); box-shadow: var(--shadow); margin-bottom: 16px; }
.card-header { padding: 14px 18px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 10px; }
.card-title { font-weight: 600; font-size: 14px; }
.card-body { padding: 16px 18px; }
.card-body p { color: var(--muted); margin-bottom: 8px; }
.badge { display: inline-block; font-size: 11px; padding: 2px 7px; border-radius: 99px;
  font-weight: 500; }
.badge-blue  { background: var(--accent-dim); color: #1d4ed8; }
.badge-green { background: var(--green-dim); color: #15803d; }
.badge-amber { background: var(--amber-dim); color: #92400e; }
.badge-gray  { background: #f1f5f9; color: #475569; }

/* Grid */
.grid-2 { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.grid-3 { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }

/* Mermaid container */
.mermaid-wrap { border: 1px solid var(--border); border-radius: var(--radius);
  padding: 16px; background: var(--surface); margin-bottom: 20px; overflow-x: auto; }

/* Tables */
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { text-align: left; padding: 8px 12px; font-weight: 600; border-bottom: 2px solid var(--border);
  color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
td { padding: 8px 12px; border-bottom: 1px solid var(--border); vertical-align: top; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: var(--bg); }

/* Service row */
.svc-row { display: flex; align-items: center; gap: 8px; padding: 12px 16px;
  border-bottom: 1px solid var(--border); cursor: pointer; transition: background .1s; }
.svc-row:hover { background: var(--bg); }
.svc-row:last-child { border-bottom: none; }
.svc-icon { width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center;
  justify-content: center; font-size: 13px; flex-shrink: 0; }
.svc-icon.backend  { background: #e0e7ff; }
.svc-icon.frontend { background: var(--accent-dim); }
.svc-icon.external { background: var(--amber-dim); }
.svc-icon.worker   { background: var(--green-dim); }
.svc-name { font-weight: 500; flex: 1; }
.svc-domain { color: var(--muted); font-size: 12px; }

/* Steps */
.step { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
.step:last-child { border-bottom: none; }
.step-id { font-weight: 700; min-width: 28px; color: var(--accent); font-size: 12px; }
.step-arrow { color: var(--muted); font-size: 11px; white-space: nowrap; }
.step-label { flex: 1; }
.step-meta { font-size: 11px; color: var(--muted); }

/* Perspective toggle */
.persp-tabs { display: flex; gap: 0; border: 1px solid var(--border);
  border-radius: 6px; overflow: hidden; margin-bottom: 16px; width: fit-content; }
.persp-tab { padding: 6px 14px; cursor: pointer; font-size: 12px; font-weight: 500;
  color: var(--muted); background: var(--surface); transition: all .15s; }
.persp-tab.active { background: var(--accent); color: #fff; }

/* Rules list */
.rules-list { list-style: none; }
.rules-list li { padding: 5px 0; padding-left: 16px; position: relative; color: var(--text); }
.rules-list li::before { content: '–'; position: absolute; left: 0; color: var(--muted); }

/* Collapse accordion */
details summary { cursor: pointer; list-style: none; padding: 12px 18px;
  display: flex; align-items: center; gap: 8px; }
details summary::before { content: '▶'; font-size: 10px; color: var(--muted);
  transition: transform .15s; }
details[open] summary::before { transform: rotate(90deg); }
details summary::-webkit-details-marker { display: none; }
</style>
</head>
<body>
<div id="shell">
  <header id="topbar">
    <h1 id="page-title">${escHtml(pageTitle)}</h1>
    <nav id="layer-tabs"></nav>
    <div id="breadcrumb"></div>
  </header>
  <main id="main"></main>
</div>

<script>
// ── Embedded SDL data ─────────────────────────────────────────────────────────
const SDL = ${serialized};

// ── State ─────────────────────────────────────────────────────────────────────
let state = {
  layer: 'platform',      // 'platform' | 'service_flows' | 'layer_logic'
  platformIdx: 0,         // index into SDL.platforms
  flowBundleIdx: 0,       // index into SDL.serviceFlowBundles
  serviceId: null,        // string | null — current layer_logic service
  operationId: null,      // string | null — currently expanded operation
  perspective: 'business' // 'business' | 'routing'
};

function navigate(patch) {
  Object.assign(state, patch);
  render();
}

// ── Exposed for Mermaid click callbacks ───────────────────────────────────────
window.__sdlNavService = function(id) { navigate({ layer: 'layer_logic', serviceId: id }); };

// ── Mermaid ───────────────────────────────────────────────────────────────────
// Guard: mermaid CDN may still be loading or unavailable in offline contexts.
if (typeof mermaid !== 'undefined') {
  mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'default',
    flowchart: { useMaxWidth: false, htmlLabels: true } });
}

async function renderMermaid(containerId, graphDef) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (typeof mermaid === 'undefined') {
    el.textContent = '(Mermaid not loaded — diagrams require an internet connection)';
    return;
  }
  try {
    const id = 'g' + Math.random().toString(36).slice(2);
    const { svg } = await mermaid.render(id, graphDef);
    el.innerHTML = svg;
  } catch(e) {
    el.textContent = 'Diagram error: ' + e.message;
  }
}

// ── Top-bar rendering ─────────────────────────────────────────────────────────
function renderTopBar() {
  // Tabs — only show tabs that have data
  const tabs = document.getElementById('layer-tabs');
  const available = [];
  if (SDL.platforms.length)           available.push({ id: 'platform',      label: 'Platform' });
  if (SDL.serviceFlowBundles.length)  available.push({ id: 'service_flows', label: 'Service Flows' });
  if (SDL.services.length)            available.push({ id: 'layer_logic',   label: 'Service Logic' });

  tabs.innerHTML = available.map(t =>
    \`<div class="tab \${state.layer === t.id ? 'active' : ''}"
          onclick="navigate({layer:'\${t.id}', serviceId: null, operationId: null})">\${t.label}</div>\`
  ).join('');

  // Breadcrumb
  const bc = document.getElementById('breadcrumb');
  const crumbs = [];
  if (state.layer === 'layer_logic' && state.serviceId) {
    const svc = SDL.services.find(s => s.serviceId === state.serviceId);
    const label = svc ? svc.manifest.label : state.serviceId;
    crumbs.push(\`<span class="crumb" onclick="navigate({layer:'platform',serviceId:null})">\${SDL.platforms[0]?.label ?? 'Platform'}</span>\`);
    crumbs.push(\`<span>›</span><strong>\${esc(String(label))}</strong>\`);
  }
  bc.innerHTML = crumbs.join(' ');
}

// ── Platform view ─────────────────────────────────────────────────────────────
function renderPlatform() {
  const p = SDL.platforms[state.platformIdx];
  if (!p) { document.getElementById('main').innerHTML = '<p>No platform data found.</p>'; return; }

  const svcs = p.services || [];

  // Build dependency edges from consumes/exposes
  const exposedBy = new Map();
  for (const s of svcs) for (const ex of (s.exposes || [])) exposedBy.set(ex, s.id);
  const edges = [];
  for (const s of svcs) {
    for (const con of (s.consumes || [])) {
      const provider = exposedBy.get(con);
      if (provider && provider !== s.id) {
        const proto = con.split(':')[0];
        edges.push({ from: s.id, to: provider, label: proto });
      }
    }
  }
  // Deduplicate edges (same from/to pair, keep first label)
  const edgeKey = new Set();
  const dedupEdges = edges.filter(e => {
    const k = e.from + '→' + e.to;
    if (edgeKey.has(k)) return false;
    edgeKey.add(k);
    return true;
  });

  // Mermaid graph
  const kindCls = { frontend: ':::frontend', external: ':::external', worker: ':::worker' };
  let graph = 'graph LR\\n';
  graph += '  classDef frontend fill:#dbeafe,stroke:#3b82f6,color:#1e40af\\n';
  graph += '  classDef external fill:#fef3c7,stroke:#d97706,color:#92400e\\n';
  graph += '  classDef worker fill:#dcfce7,stroke:#16a34a,color:#15803d\\n';
  for (const s of svcs) {
    const cls = kindCls[s.kind] || '';
    const lbl = s.kind ? s.label + '\\\\n[' + s.kind + ']' : s.label;
    graph += \`  \${safeId(s.id)}["\${lbl}"]\${cls}\\n\`;
    graph += \`  click \${safeId(s.id)} __sdlNavService\\n\`;
  }
  for (const e of dedupEdges) {
    graph += \`  \${safeId(e.from)} -->|"\${e.label}"| \${safeId(e.to)}\\n\`;
  }

  // Group services by domain
  const byDomain = new Map();
  for (const s of svcs) {
    const d = s.domain || 'other';
    if (!byDomain.has(d)) byDomain.set(d, []);
    byDomain.get(d).push(s);
  }

  const domainHtml = [...byDomain.entries()].map(([domain, list]) => \`
    <div style="margin-bottom:8px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:6px;">\${esc(domain)}</div>
      \${list.map(s => \`
        <div class="svc-row" onclick="navigate({layer:'layer_logic',serviceId:'\${s.id}'})">
          <div class="svc-icon \${s.kind || 'backend'}">\${kindIcon(s.kind)}</div>
          <div class="svc-name">\${esc(s.label)}</div>
          \${s.kind ? \`<span class="badge badge-blue">\${s.kind}</span>\` : ''}
          \${(s.tags||[]).includes('critical-path') ? '<span class="badge badge-amber">critical-path</span>' : ''}
          <svg width="12" height="12" viewBox="0 0 12 12" style="color:var(--muted);flex-shrink:0"><path d="M4 2l4 4-4 4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
        </div>\`).join('')}
    </div>\`).join('');

  const infra = p.shared_infrastructure || {};
  const infraBadges = Object.entries(infra).filter(([,v]) => v && typeof v === 'object' && v.kind)
    .map(([k, v]) => \`<span class="badge badge-gray">\${k.replace(/_/g,' ')}: \${v.kind}</span>\`).join(' ');

  document.getElementById('main').innerHTML = \`
    <div style="margin-bottom:20px">
      \${p.description ? \`<p style="color:var(--muted);max-width:720px">\${esc(String(p.description))}</p>\` : ''}
      \${infraBadges ? \`<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">\${infraBadges}</div>\` : ''}
    </div>
    <div class="card" style="margin-bottom:20px">
      <div class="card-header"><span class="card-title">Service Dependency Graph</span>
        <span style="font-size:11px;color:var(--muted)">Click a node or service below to view service logic</span></div>
      <div class="card-body"><div class="mermaid-wrap"><div id="platform-graph"></div></div></div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Services</span>
        <span class="badge badge-gray">\${svcs.length}</span></div>
      \${domainHtml}
    </div>\`;

  renderMermaid('platform-graph', graph);
}

// ── Service flows view ────────────────────────────────────────────────────────
function renderServiceFlows() {
  const bundle = SDL.serviceFlowBundles[state.flowBundleIdx];
  if (!bundle) { document.getElementById('main').innerHTML = '<p>No service flow data found.</p>'; return; }

  const flowsHtml = bundle.flows.map(flow => {
    const steps = flow.steps || [];
    const actors = new Set(steps.flatMap(s => [s.from_service, s.to_service]).filter(Boolean));

    // Mermaid sequence diagram
    let seq = 'sequenceDiagram\\n';
    const actorAlias = id => id.replace(/-/g, '_');
    const trigger = flow.trigger;
    if (trigger?.actor && !actors.has(trigger.actor)) actors.add(trigger.actor);
    for (const a of actors) {
      const label = SDL.platforms[0]?.services?.find(s => s.id === a)?.label ?? a;
      seq += \`  participant \${actorAlias(a)} as \${label}\\n\`;
    }
    let parallelOpen = false;
    for (const step of steps) {
      const from = actorAlias(step.from_service);
      const to   = actorAlias(step.to_service);
      const arrow = step.style === 'async' ? '-->>' : '->>';
      const lbl = String(step.label || '').replace(/"/g, "'");
      if (step.parallel && !parallelOpen) { seq += '  par\\n'; parallelOpen = true; }
      else if (!step.parallel && parallelOpen) { seq += '  end\\n'; parallelOpen = false; }
      seq += \`  \${from}\${arrow}\${to}: \${lbl}\\n\`;
    }
    if (parallelOpen) seq += '  end\\n';

    const stepsHtml = steps.map(s => {
      const from = SDL.platforms[0]?.services?.find(sv => sv.id === s.from_service)?.label ?? s.from_service;
      const to   = SDL.platforms[0]?.services?.find(sv => sv.id === s.to_service)?.label ?? s.to_service;
      const styleIcon = s.style === 'async' ? '⇢' : '→';
      const protoBadge = s.protocol ? \`<span class="badge badge-gray">\${s.protocol}</span>\` : '';
      const asyncBadge = s.style === 'async' ? '<span class="badge badge-blue">async</span>' : '';
      return \`<div class="step">
        <div class="step-id">\${s.id}</div>
        <div style="flex:1">
          <div style="font-weight:500">\${esc(String(s.label||''))} \${protoBadge} \${asyncBadge}</div>
          <div class="step-arrow">\${esc(String(from))} \${styleIcon} \${esc(String(to))}</div>
          \${s.notes ? \`<div class="step-meta" style="margin-top:4px">\${esc(String(s.notes))}</div>\` : ''}
        </div>
      </div>\`;
    }).join('');

    const biz = flow.business || {};
    const diagramId = 'flow-' + flow.id;

    return \`<details class="card" style="margin-bottom:16px" open>
      <summary class="card-header" style="border-bottom:none">
        <div style="flex:1">
          <span class="card-title">\${esc(String(flow.label||flow.id))}</span>
          \${(flow.tags||[]).includes('critical-path') ? ' <span class="badge badge-amber">critical-path</span>' : ''}
        </div>
      </summary>
      <div class="card-body" style="border-top:1px solid var(--border)">
        \${biz.summary ? \`<p style="margin-bottom:16px">\${esc(String(biz.summary))}</p>\` : ''}
        <div class="mermaid-wrap"><div id="\${diagramId}"></div></div>
        <div style="margin-top:16px">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px">Steps</div>
          \${stepsHtml}
        </div>
        \${biz.failure_modes?.length ? \`<div style="margin-top:16px">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px">Failure Modes</div>
          \${biz.failure_modes.map(f => \`<div style="padding:6px 0;border-bottom:1px solid var(--border)">
            <span style="font-weight:500">\${esc(String(f.condition))}</span>
            <span style="color:var(--muted)"> — \${esc(String(f.response))}</span>
          </div>\`).join('')}
        </div>\` : ''}
      </div>
    </details>\`;
  }).join('');

  document.getElementById('main').innerHTML = flowsHtml;

  // Render each Mermaid diagram
  bundle.flows.forEach(flow => {
    const steps = flow.steps || [];
    const actors = new Set(steps.flatMap(s => [s.from_service, s.to_service]).filter(Boolean));
    const actorAlias = id => id.replace(/-/g, '_');
    let seq = 'sequenceDiagram\\n';
    for (const a of actors) {
      const label = SDL.platforms[0]?.services?.find(s => s.id === a)?.label ?? a;
      seq += \`  participant \${actorAlias(a)} as \${label}\\n\`;
    }
    let parallelOpen = false;
    for (const step of steps) {
      const from = actorAlias(step.from_service);
      const to   = actorAlias(step.to_service);
      const arrow = step.style === 'async' ? '-->>' : '->>';
      const lbl = String(step.label || '').replace(/"/g, "'");
      if (step.parallel && !parallelOpen) { seq += '  par\\n'; parallelOpen = true; }
      else if (!step.parallel && parallelOpen) { seq += '  end\\n'; parallelOpen = false; }
      seq += \`  \${from}\${arrow}\${to}: \${lbl}\\n\`;
    }
    if (parallelOpen) seq += '  end\\n';
    renderMermaid('flow-' + flow.id, seq);
  });
}

// ── Layer logic view ──────────────────────────────────────────────────────────
function renderLayerLogic() {
  // If no specific service selected, show service list
  if (!state.serviceId) {
    const cards = SDL.services.map(svc => {
      const m = svc.manifest;
      return \`<div class="card" style="cursor:pointer" onclick="navigate({serviceId:'\${svc.serviceId}'})">
        <div class="card-header">
          <div class="svc-icon \${kindForService(svc)}">⚙</div>
          <span class="card-title">\${esc(String(m.label||svc.serviceId))}</span>
        </div>
        <div class="card-body">
          \${m.description ? \`<p>\${esc(String(m.description))}</p>\` : ''}
          <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
            \${m.domain ? \`<span class="badge badge-blue">\${m.domain}</span>\` : ''}
            <span class="badge badge-gray">\${svc.entryPoints.length} entry points</span>
            <span class="badge badge-gray">\${svc.operations.length} operations</span>
            <span class="badge badge-gray">\${svc.dependencies.length} dependencies</span>
          </div>
        </div>
      </div>\`;
    }).join('');
    document.getElementById('main').innerHTML = \`<div class="grid-2">\${cards}</div>\`;
    return;
  }

  const svc = SDL.services.find(s => s.serviceId === state.serviceId);
  if (!svc) { document.getElementById('main').innerHTML = '<p>Service not found.</p>'; return; }
  const m = svc.manifest;

  // Entry points table
  const epRows = svc.entryPoints.map(ep => {
    const opRef = ep.operation_ref || '—';
    const http  = ep.http ? \`<code>\${ep.http.method} \${ep.http.path}</code>\` : '';
    const event = ep.event ? \`<code>\${ep.event.topic}</code>\` : '';
    return \`<tr>
      <td><strong>\${esc(String(ep.id||''))}</strong></td>
      <td><span class="badge badge-gray">\${esc(String(ep.kind||''))}</span></td>
      <td>\${http || event}</td>
      <td><code>\${esc(String(opRef))}</code></td>
    </tr>\`;
  }).join('');

  // Operations accordion
  const opsHtml = svc.operations.map(op => {
    const isOpen = state.operationId === op.id;
    const biz = op.business || {};
    const routing = op.routing;
    const persp = state.perspective;

    const bizContent = \`
      <p style="margin-bottom:12px">\${esc(String(biz.summary||''))}</p>
      \${biz.rules?.length ? \`<div style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:6px">Business Rules</div>
        <ul class="rules-list">\${biz.rules.map(r => \`<li>\${esc(String(r))}</li>\`).join('')}</ul>
      </div>\` : ''}
      \${biz.outcomes?.length ? \`<div style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:6px">Outcomes</div>
        <ul class="rules-list">\${biz.outcomes.map(o => \`<li>\${esc(String(o))}</li>\`).join('')}</ul>
      </div>\` : ''}
      \${biz.failure_modes?.length ? \`<div>
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:6px">Failure Modes</div>
        \${biz.failure_modes.map(f => \`<div style="padding:6px 0;border-top:1px solid var(--border)">
          <span style="font-weight:500">\${esc(String(f.condition))}</span>
          <span style="color:var(--muted)"> — \${esc(String(f.response))}</span>
        </div>\`).join('')}
      </div>\` : ''}\`;

    const routingContent = routing ? \`
      <p style="margin-bottom:12px">Handler: <code>\${esc(String(routing.handler||''))}</code>
        \${routing.file_ref ? \` in <code>\${esc(String(routing.file_ref))}</code>\` : ''}</p>
      \${routing.middleware_chain?.length ? \`<div style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:6px">Middleware</div>
        \${routing.middleware_chain.map(mw => \`<div style="padding:4px 0">
          <code>\${esc(String(mw.name))}</code>
          \${mw.purpose ? \`<span style="color:var(--muted)"> — \${esc(String(mw.purpose))}</span>\` : ''}
        </div>\`).join('')}
      </div>\` : ''}
      \${routing.steps?.length ? \`<div>
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:6px">Execution Steps</div>
        \${routing.steps.map(s => \`<div class="step">
          <div class="step-id">\${esc(String(s.id))}</div>
          <div style="flex:1">
            <div>\${esc(String(s.action||''))}</div>
            \${s.calls ? \`<div class="step-meta"><code>\${esc(String(s.calls))}</code></div>\` : ''}
            \${s.dependency_ref ? \`<div class="step-meta">dep: <code>\${esc(String(s.dependency_ref))}</code></div>\` : ''}
            \${s.notes ? \`<div class="step-meta">\${esc(String(s.notes))}</div>\` : ''}
          </div>
          \${s.parallel ? '<span class="badge badge-blue">parallel</span>' : ''}
        </div>\`).join('')}
      </div>\` : ''}\` : '<p style="color:var(--muted)">No routing block — business perspective only.</p>';

    const perspTabs = \`<div class="persp-tabs">
      <div class="persp-tab \${persp==='business'?'active':''}"
           onclick="event.stopPropagation();navigate({operationId:'\${op.id}',perspective:'business'})">Business</div>
      <div class="persp-tab \${persp==='routing'?'active':''} \${!routing?'':'...'}"
           onclick="event.stopPropagation();navigate({operationId:'\${op.id}',perspective:'routing'})"
           style="\${!routing?'opacity:.5;cursor:not-allowed':''}">Routing</div>
    </div>\`;

    return \`<details class="card" style="margin-bottom:12px" \${isOpen?'open':''}>
      <summary onclick="navigate({operationId:'\${isOpen?null:op.id}'})" style="display:flex;align-items:center;gap:8px;padding:12px 18px;cursor:pointer;list-style:none">
        <svg width="10" height="10" viewBox="0 0 10 10" style="flex-shrink:0;transition:transform .15s;\${isOpen?'transform:rotate(90deg)':''}"><path d="M2 1l5 4-5 4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
        <strong style="flex:1">\${esc(String(op.label||op.id))}</strong>
        \${op.input_shape_ref ? \`<code style="font-size:11px">\${esc(String(op.input_shape_ref))}</code>\` : ''}
        <div style="display:flex;gap:4px">\${(op.tags||[]).slice(0,3).map(t => \`<span class="badge badge-gray">\${esc(String(t))}</span>\`).join('')}</div>
      </summary>
      \${isOpen ? \`<div style="padding:0 18px 18px;border-top:1px solid var(--border)">
        <div style="padding-top:16px">\${perspTabs}</div>
        \${persp === 'business' ? bizContent : routingContent}
      </div>\` : ''}
    </details>\`;
  }).join('');

  // Dependencies
  const depsHtml = svc.dependencies.map(dep => \`
    <tr>
      <td><strong>\${esc(String(dep.id||''))}</strong></td>
      <td><span class="badge badge-gray">\${esc(String(dep.kind||''))}</span></td>
      <td>\${esc(String(dep.label||''))}</td>
      <td style="color:var(--muted)">\${dep.interface?.protocol ? \`<code>\${esc(String(dep.interface.protocol))}</code>\` : ''}</td>
    </tr>\`).join('');

  // Data shapes
  const shapesHtml = svc.dataShapes.map(ds => \`
    <div class="card" style="margin-bottom:10px">
      <div class="card-header">
        <span class="card-title">\${esc(String(ds.label||ds.id))}</span>
        <span class="badge badge-gray">\${esc(String(ds.kind||''))}</span>
        <code style="font-size:11px;margin-left:auto">\${esc(String(ds.id||''))}</code>
      </div>
      \${ds.fields?.length ? \`<div class="card-body" style="padding:0">
        <table><thead><tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
        <tbody>\${(ds.fields||[]).map(f => \`<tr>
          <td><code>\${esc(String(f.name))}</code></td>
          <td><code>\${esc(String(f.type))}</code></td>
          <td>\${f.required !== false ? '✓' : ''}</td>
          <td style="color:var(--muted)">\${esc(String(f.description||''))}</td>
        </tr>\`).join('')}</tbody></table>
      </div>\` : ''}
    </div>\`).join('');

  document.getElementById('main').innerHTML = \`
    <div style="margin-bottom:20px">
      \${m.description ? \`<p style="color:var(--muted);max-width:720px">\${esc(String(m.description))}</p>\` : ''}
      <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
        \${m.domain ? \`<span class="badge badge-blue">\${m.domain}</span>\` : ''}
        \${m.technology?.language ? \`<span class="badge badge-gray">\${m.technology.language}\${m.technology.framework ? ' / ' + m.technology.framework : ''}</span>\` : ''}
      </div>
    </div>

    <section style="margin-bottom:28px">
      <h2 style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:12px">Entry Points</h2>
      <div class="card"><div class="card-body" style="padding:0">
        <table><thead><tr><th>ID</th><th>Kind</th><th>Interface</th><th>Operation</th></tr></thead>
        <tbody>\${epRows}</tbody></table>
      </div></div>
    </section>

    <section style="margin-bottom:28px">
      <h2 style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:12px">Operations</h2>
      \${opsHtml}
    </section>

    <section style="margin-bottom:28px">
      <h2 style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:12px">Dependencies</h2>
      <div class="card"><div class="card-body" style="padding:0">
        <table><thead><tr><th>ID</th><th>Kind</th><th>Label</th><th>Protocol</th></tr></thead>
        <tbody>\${depsHtml}</tbody></table>
      </div></div>
    </section>

    <section>
      <h2 style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:12px">Data Shapes</h2>
      \${shapesHtml}
    </section>\`;
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function safeId(id) { return id.replace(/[^a-zA-Z0-9_]/g, '_'); }
function kindIcon(kind) {
  return { frontend: '🖥', external: '🌐', worker: '⚙' }[kind] || '◈';
}
function kindForService(svc) {
  // Try to derive kind from platform manifest
  const actor = SDL.platforms[0]?.services?.find(s => s.id === svc.serviceId);
  return actor?.kind || 'backend';
}

// ── Main render loop ──────────────────────────────────────────────────────────
function render() {
  renderTopBar();
  switch (state.layer) {
    case 'platform':      renderPlatform();      break;
    case 'service_flows': renderServiceFlows();  break;
    case 'layer_logic':   renderLayerLogic();    break;
    default: renderPlatform();
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
(function init() {
  // Choose a sensible default layer
  if (SDL.platforms.length)          state.layer = 'platform';
  else if (SDL.serviceFlowBundles.length) state.layer = 'service_flows';
  else if (SDL.services.length)      state.layer = 'layer_logic';
  render();
})();
</script>
</body>
</html>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function deriveTile(data: RenderData): string {
  if (data.platforms[0]?.label) return data.platforms[0].label;
  if (data.services[0]?.manifest?.label) return String(data.services[0].manifest.label);
  return 'SDL';
}
