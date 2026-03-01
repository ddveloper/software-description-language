declare const SDL: any;
import { OV, NODE_W, NODE_H, MACRO_W, MACRO_H, MICRO_W, MICRO_H } from '../state.js';
import { esc } from '../utils.js';
import { groupByDomain, getDomainBounds, makeEdgePath } from './layout.js';

export function buildOvDomains(allSvcs: any[]): void {
  const g = document.getElementById('ov-domains');
  if (!g) return;
  const byDomain = groupByDomain(allSvcs);
  let html = '';
  byDomain.forEach((svcs, domain) => {
    const b = getDomainBounds(svcs);
    if (b.w === 0) return;
    html += '<rect data-domain="' + esc(domain) + '" x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" rx="10" fill="#f0f4ff" stroke="#c7d2fe" stroke-width="1.5"/>';
    html += '<text data-domain-lbl="' + esc(domain) + '" x="' + (b.x + 14) + '" y="' + (b.y + 18) + '" font-size="11" font-weight="600" fill="#6b7280">' + esc(domain) + '</text>';
  });
  g.innerHTML = html;
}

export function buildOvEdges(allSvcs: any[]): void {
  const g = document.getElementById('ov-edges');
  if (!g) return;
  const exposedBy = new Map<string, string>();
  allSvcs.forEach((s: any) => (s.exposes || []).forEach((ex: string) => exposedBy.set(ex, s.id)));
  const edgeMap = new Map<string, { from: string; to: string; labels: string[] }>();
  allSvcs.forEach((s: any) => {
    (s.consumes || []).forEach((con: string) => {
      const prov = exposedBy.get(con);
      if (!prov || prov === s.id) return;
      const key = s.id + '|' + prov;
      if (!edgeMap.has(key)) edgeMap.set(key, { from: s.id, to: prov, labels: [] });
      edgeMap.get(key)!.labels.push(con);
    });
  });
  let html = '';
  edgeMap.forEach(({ from, to, labels }) => {
    const fp = OV.positions[from], tp = OV.positions[to];
    if (!fp || !tp) return;
    const d = makeEdgePath(fp, tp, false);
    const lbl = esc(labels.join(', '));
    html += '<path class="ov-edge-hit" data-from="' + from + '" data-to="' + to + '" data-labels="' + lbl + '" data-type="dep" d="' + d + '" stroke="transparent" stroke-width="12" fill="none"/>';
    html += '<path class="ov-edge-vis" data-from="' + from + '" data-to="' + to + '" d="' + d + '" stroke="#94a3b8" stroke-width="1.5" fill="none" marker-end="url(#ov-arr)"/>';
  });
  g.innerHTML = html;
}

export function buildOvFlows(): void {
  const g = document.getElementById('ov-flows');
  if (!g) return;
  const flowMap = new Map<string, { from: string; to: string; labels: string[] }>();
  (SDL.serviceFlowBundles as any[]).forEach(bundle => {
    bundle.flows.forEach((flow: any) => {
      (flow.steps || []).forEach((step: any) => {
        if (!step.from_service || !step.to_service) return;
        const key = step.from_service + '|' + step.to_service;
        if (!flowMap.has(key)) flowMap.set(key, { from: step.from_service, to: step.to_service, labels: [] });
        const lbs = flowMap.get(key)!.labels;
        const lbl = String(step.label || step.id || '');
        if (lbl && !lbs.includes(lbl)) lbs.push(lbl);
      });
    });
  });
  let html = '';
  flowMap.forEach(({ from, to, labels }) => {
    const fp = OV.positions[from], tp = OV.positions[to];
    if (!fp || !tp) return;
    const d = makeEdgePath(fp, tp, true);
    const lbl = esc(labels.slice(0, 4).join(' · '));
    html += '<path class="ov-edge-hit" data-from="' + from + '" data-to="' + to + '" data-labels="' + lbl + '" data-type="flow" d="' + d + '" stroke="transparent" stroke-width="12" fill="none"/>';
    html += '<path class="ov-edge-vis" data-from="' + from + '" data-to="' + to + '" d="' + d + '" stroke="#93c5fd" stroke-width="1.5" stroke-dasharray="5,3" fill="none" marker-end="url(#ov-arr-b)"/>';
  });
  g.innerHTML = html;
}

export function buildOvNodes(allSvcs: any[]): void {
  const g = document.getElementById('ov-nodes');
  if (!g) return;
  const COLORS: Record<string, { fill: string; stroke: string }> = {
    frontend: { fill: '#dbeafe', stroke: '#93c5fd' },
    external: { fill: '#fef3c7', stroke: '#fcd34d' },
    worker: { fill: '#dcfce7', stroke: '#86efac' },
    backend: { fill: '#f0f4ff', stroke: '#c7d2fe' },
  };
  let html = '';
  allSvcs.forEach((s: any) => {
    const pos = OV.positions[s.id] || { x: 0, y: 0 };
    const c = COLORS[s.kind] || COLORS.backend;
    const tags = (s.tags || []).slice(0, 3).join(' · ');
    html += '<g class="ov-node" data-id="' + s.id + '" transform="translate(' + pos.x + ',' + pos.y + ')">';
    html += '<rect class="ov-box" width="' + NODE_W + '" height="' + NODE_H + '" rx="8" fill="' + c.fill + '" stroke="' + c.stroke + '" stroke-width="1.5"/>';
    html += '<text x="' + (NODE_W / 2) + '" y="24" text-anchor="middle" font-size="13" font-weight="600" fill="#1e293b">' + esc(String(s.label || s.id)) + '</text>';
    html += '<text class="ov-kind" x="' + (NODE_W / 2) + '" y="41" text-anchor="middle" font-size="11" fill="#64748b">' + esc(s.kind ? '[' + s.kind + ']' : (s.domain || '')) + '</text>';
    if (tags) html += '<text class="ov-tags" x="' + (NODE_W / 2) + '" y="56" text-anchor="middle" font-size="10" fill="#94a3b8">' + esc(tags) + '</text>';
    html += '</g>';
  });
  g.innerHTML = html;
  document.querySelectorAll('.ov-node').forEach(el => {
    (el as HTMLElement).addEventListener('mousedown', e => {
      e.stopPropagation();
      const id = (el as HTMLElement).dataset.id!;
      const pos = OV.positions[id] || { x: 0, y: 0 };
      OV.drag = { id, sx: (e as MouseEvent).clientX, sy: (e as MouseEvent).clientY, ox: pos.x, oy: pos.y, moved: false };
      el.classList.add('dragging');
    });
  });
}

export function buildMacroContent(): void {
  const domains = document.getElementById('ov-domains');
  const edges = document.getElementById('ov-edges');
  const flows = document.getElementById('ov-flows');
  const nodes = document.getElementById('ov-nodes');
  if (domains) domains.innerHTML = '';
  if (edges) edges.innerHTML = '';
  if (flows) flows.innerHTML = '';
  if (!nodes) return;
  nodes.innerHTML = (SDL.platforms as any[]).map(p => {
    const pid = p.id || 'platform';
    const pos = OV.positions[pid] || { x: 0, y: 0 };
    const svcCount = (p.services || []).length;
    const label = esc(String(p.label || pid));
    return `<g class="ov-node ov-macro-node" data-id="${esc(pid)}" transform="translate(${pos.x},${pos.y})" onclick="switchOvSublayer('meso')">
      <rect class="ov-box" width="${MACRO_W}" height="${MACRO_H}" rx="10" fill="#e0e7ff" stroke="#a5b4fc" stroke-width="1.5"/>
      <text x="${MACRO_W / 2}" y="36" text-anchor="middle" font-size="15" font-weight="600" fill="#1e293b">${label}</text>
      <text x="${MACRO_W / 2}" y="56" text-anchor="middle" font-size="12" fill="#64748b">${svcCount} service${svcCount !== 1 ? 's' : ''}</text>
    </g>`;
  }).join('');
}

export function buildMicroContent(svcId: string | null): void {
  const domains = document.getElementById('ov-domains');
  const edges = document.getElementById('ov-edges');
  const flows = document.getElementById('ov-flows');
  const nodes = document.getElementById('ov-nodes');
  if (domains) domains.innerHTML = '';
  if (flows) flows.innerHTML = '';
  if (!nodes || !edges) return;

  const svc = (SDL.services as any[]).find(s => s.serviceId === svcId);
  if (!svc) {
    nodes.innerHTML = `<text x="40" y="60" font-size="13" fill="#64748b">No layer_logic data for this service.</text>`;
    edges.innerHTML = '';
    return;
  }
  const eps: any[] = svc.entryPoints || [];
  const ops: any[] = svc.operations || [];
  const deps: any[] = svc.dependencies || [];

  let header = '';
  const mkHeader = (x: number, label: string) =>
    `<text x="${x}" y="20" font-size="11" font-weight="600" text-transform="uppercase" letter-spacing=".06em" fill="#94a3b8">${label}</text>`;
  if (eps.length) header += mkHeader(40, 'Entry Points');
  if (ops.length) header += mkHeader(300, 'Operations');
  if (deps.length) header += mkHeader(560, 'Dependencies');

  const epNodes = eps.map(ep => {
    const pos = OV.positions['ep:' + ep.id] || { x: 40, y: 40 };
    const label = esc(String(ep.label || ep.id));
    const kind = esc(String(ep.kind || ''));
    return `<g class="ov-node" data-id="ep:${esc(ep.id)}" transform="translate(${pos.x},${pos.y})">
      <rect class="ov-box ov-micro-ep" width="${MICRO_W}" height="${MICRO_H}" rx="7" stroke="#a5b4fc" stroke-width="1.5"/>
      <text x="10" y="20" font-size="12" font-weight="600" fill="#1e293b">${label}</text>
      ${kind ? `<text x="10" y="36" font-size="10" fill="#64748b">[${kind}]</text>` : ''}
    </g>`;
  }).join('');

  const opNodes = ops.map(op => {
    const pos = OV.positions['op:' + op.id] || { x: 300, y: 40 };
    const label = esc(String(op.label || op.id));
    return `<g class="ov-node" data-id="op:${esc(op.id)}" transform="translate(${pos.x},${pos.y})">
      <rect class="ov-box ov-micro-op" width="${MICRO_W}" height="${MICRO_H}" rx="7" stroke="#86efac" stroke-width="1.5"/>
      <text x="10" y="20" font-size="12" font-weight="600" fill="#1e293b">${label}</text>
    </g>`;
  }).join('');

  const depNodes = deps.map(d => {
    const pos = OV.positions['dep:' + d.id] || { x: 560, y: 40 };
    const label = esc(String(d.label || d.id));
    const proto = d.protocol ? ` [${esc(String(d.protocol))}]` : '';
    return `<g data-id="dep:${esc(d.id)}" transform="translate(${pos.x},${pos.y})">
      <rect class="ov-micro-dep" width="${MICRO_W}" height="${MICRO_H}" rx="7" stroke="#fcd34d" stroke-width="1.5"/>
      <text x="10" y="20" font-size="12" font-weight="600" fill="#1e293b">${label}</text>
      ${proto ? `<text x="10" y="36" font-size="10" fill="#92400e">${proto}</text>` : ''}
    </g>`;
  }).join('');

  nodes.innerHTML = header + epNodes + opNodes + depNodes;

  const epOpEdges = eps.flatMap(ep => {
    const refs = ep.operation_ref ? [ep.operation_ref] : (ep.operation_refs || []);
    return refs.map((ref: string) => {
      const fp = OV.positions['ep:' + ep.id];
      const tp = OV.positions['op:' + ref];
      if (!fp || !tp) return '';
      const x1 = fp.x + MICRO_W, y1 = fp.y + MICRO_H / 2;
      const x2 = tp.x, y2 = tp.y + MICRO_H / 2;
      const cx = (x1 + x2) / 2;
      return `<path class="ov-edge-vis" d="M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ov-arr-micro)" data-from="ep:${ep.id}" data-to="op:${ref}"/>`;
    });
  }).join('');

  const opDepEdges = ops.flatMap(op => {
    const steps: any[] = (op.routing && op.routing.steps) ? op.routing.steps : [];
    const seen = new Set<string>();
    return steps
      .filter((s: any) => s.dependency_ref && !seen.has(s.dependency_ref) && seen.add(s.dependency_ref))
      .map((s: any) => {
        const fp = OV.positions['op:' + op.id];
        const tp = OV.positions['dep:' + s.dependency_ref];
        if (!fp || !tp) return '';
        const x1 = fp.x + MICRO_W, y1 = fp.y + MICRO_H / 2;
        const x2 = tp.x, y2 = tp.y + MICRO_H / 2;
        const cx = (x1 + x2) / 2;
        return `<path class="ov-edge-vis" d="M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}" fill="none" stroke="#fbbf24" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ov-arr-dep)" data-from="op:${op.id}" data-to="dep:${s.dependency_ref}"/>`;
      });
  }).join('');

  edges.innerHTML = epOpEdges + opDepEdges;

  nodes.querySelectorAll('.ov-node[data-id]').forEach(el => {
    (el as HTMLElement).addEventListener('mousedown', e => {
      e.stopPropagation();
      const id = (el as HTMLElement).dataset.id!;
      const pos = OV.positions[id] || { x: 0, y: 0 };
      OV.drag = { id, sx: (e as MouseEvent).clientX, sy: (e as MouseEvent).clientY, ox: pos.x, oy: pos.y, moved: false };
      el.classList.add('dragging');
    });
  });
}
