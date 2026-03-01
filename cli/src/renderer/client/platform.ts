declare const SDL: any;
import { state } from './state.js';
import { esc, safeId, kindIcon } from './utils.js';
import { renderMermaid } from './mermaid.js';

export function renderPlatform(): void {
  const p = (SDL.platforms as any[])[state.platformIdx];
  if (!p) { document.getElementById('main')!.innerHTML = '<p>No platform data found.</p>'; return; }

  const svcs: any[] = p.services || [];

  const exposedBy = new Map<string, string>();
  for (const s of svcs) for (const ex of (s.exposes || [])) exposedBy.set(ex, s.id);
  const edges: { from: string; to: string; label: string }[] = [];
  for (const s of svcs) {
    for (const con of (s.consumes || [])) {
      const provider = exposedBy.get(con);
      if (provider && provider !== s.id) {
        edges.push({ from: s.id, to: provider, label: con.split(':')[0] });
      }
    }
  }
  const edgeKey = new Set<string>();
  const dedupEdges = edges.filter(e => {
    const k = e.from + '→' + e.to;
    if (edgeKey.has(k)) return false;
    edgeKey.add(k);
    return true;
  });

  const kindCls: Record<string, string> = { frontend: ':::frontend', external: ':::external', worker: ':::worker' };
  let graph = 'graph LR\n';
  graph += '  classDef frontend fill:#dbeafe,stroke:#3b82f6,color:#1e40af\n';
  graph += '  classDef external fill:#fef3c7,stroke:#d97706,color:#92400e\n';
  graph += '  classDef worker fill:#dcfce7,stroke:#16a34a,color:#15803d\n';
  for (const s of svcs) {
    const cls = kindCls[s.kind] || '';
    const lbl = s.kind ? s.label + '\\n[' + s.kind + ']' : s.label;
    graph += `  ${safeId(s.id)}["${lbl}"]${cls}\n`;
    graph += `  click ${safeId(s.id)} __sdlNavService\n`;
  }
  for (const e of dedupEdges) {
    graph += `  ${safeId(e.from)} -->|"${e.label}"| ${safeId(e.to)}\n`;
  }

  const byDomain = new Map<string, any[]>();
  for (const s of svcs) {
    const d = s.domain || 'other';
    if (!byDomain.has(d)) byDomain.set(d, []);
    byDomain.get(d)!.push(s);
  }

  const domainHtml = [...byDomain.entries()].map(([domain, list]) => `
    <div style="margin-bottom:8px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:6px;">${esc(domain)}</div>
      ${list.map((s: any) => `
        <div class="svc-row" onclick="navigate({layer:'layer_logic',serviceId:'${s.id}'})">
          <div class="svc-icon ${s.kind || 'backend'}">${kindIcon(s.kind)}</div>
          <div class="svc-name">${esc(s.label)}</div>
          ${s.kind ? `<span class="badge badge-blue">${s.kind}</span>` : ''}
          ${(s.tags || []).includes('critical-path') ? '<span class="badge badge-amber">critical-path</span>' : ''}
          <svg width="12" height="12" viewBox="0 0 12 12" style="color:var(--muted);flex-shrink:0"><path d="M4 2l4 4-4 4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
        </div>`).join('')}
    </div>`).join('');

  const infra = p.shared_infrastructure || {};
  const infraBadges = Object.entries(infra).filter(([, v]) => v && typeof v === 'object' && (v as any).kind)
    .map(([k, v]) => `<span class="badge badge-gray">${k.replace(/_/g, ' ')}: ${(v as any).kind}</span>`).join(' ');

  document.getElementById('main')!.innerHTML = `
    <div style="margin-bottom:20px">
      ${p.description ? `<p style="color:var(--muted);max-width:720px">${esc(String(p.description))}</p>` : ''}
      ${infraBadges ? `<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">${infraBadges}</div>` : ''}
    </div>
    <div class="card" style="margin-bottom:20px">
      <div class="card-header"><span class="card-title">Service Dependency Graph</span>
        <span style="font-size:11px;color:var(--muted)">Click a node or service below to view service logic</span></div>
      <div class="card-body"><div class="mermaid-wrap"><div id="platform-graph"></div></div></div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Services</span>
        <span class="badge badge-gray">${svcs.length}</span></div>
      ${domainHtml}
    </div>`;

  renderMermaid('platform-graph', graph);
}
