declare const SDL: any;
import { state } from './state.js';
import { esc, kindForService } from './utils.js';

export function renderLayerLogic(): void {
  if (!state.serviceId) {
    const cards = (SDL.services as any[]).map(svc => {
      const m = svc.manifest;
      return `<div class="card" style="cursor:pointer" onclick="navigate({serviceId:'${svc.serviceId}'})">
        <div class="card-header">
          <div class="svc-icon ${kindForService(svc)}">⚙</div>
          <span class="card-title">${esc(String(m.label || svc.serviceId))}</span>
        </div>
        <div class="card-body">
          ${m.description ? `<p>${esc(String(m.description))}</p>` : ''}
          <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
            ${m.domain ? `<span class="badge badge-blue">${m.domain}</span>` : ''}
            <span class="badge badge-gray">${svc.entryPoints.length} entry points</span>
            <span class="badge badge-gray">${svc.operations.length} operations</span>
            <span class="badge badge-gray">${svc.dependencies.length} dependencies</span>
          </div>
        </div>
      </div>`;
    }).join('');
    document.getElementById('main')!.innerHTML = `<div class="grid-2">${cards}</div>`;
    return;
  }

  const svc = (SDL.services as any[]).find(s => s.serviceId === state.serviceId);
  if (!svc) { document.getElementById('main')!.innerHTML = '<p>Service not found.</p>'; return; }
  const m = svc.manifest;

  const epRows = (svc.entryPoints as any[]).map(ep => {
    const opRef = ep.operation_ref || '—';
    const http = ep.http ? `<code>${ep.http.method} ${ep.http.path}</code>` : '';
    const event = ep.event ? `<code>${ep.event.topic}</code>` : '';
    return `<tr>
      <td><strong>${esc(String(ep.id || ''))}</strong></td>
      <td><span class="badge badge-gray">${esc(String(ep.kind || ''))}</span></td>
      <td>${http || event}</td>
      <td><code>${esc(String(opRef))}</code></td>
    </tr>`;
  }).join('');

  const opsHtml = (svc.operations as any[]).map(op => {
    const isOpen = state.operationId === op.id;
    const biz = op.business || {};
    const routing = op.routing;
    const persp = state.perspective;

    const bizContent = `
      <p style="margin-bottom:12px">${esc(String(biz.summary || ''))}</p>
      ${biz.rules?.length ? `<div style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:6px">Business Rules</div>
        <ul class="rules-list">${biz.rules.map((r: string) => `<li>${esc(String(r))}</li>`).join('')}</ul>
      </div>` : ''}
      ${biz.outcomes?.length ? `<div style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:6px">Outcomes</div>
        <ul class="rules-list">${biz.outcomes.map((o: string) => `<li>${esc(String(o))}</li>`).join('')}</ul>
      </div>` : ''}
      ${biz.failure_modes?.length ? `<div>
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:6px">Failure Modes</div>
        ${biz.failure_modes.map((f: any) => `<div style="padding:6px 0;border-top:1px solid var(--border)">
          <span style="font-weight:500">${esc(String(f.condition))}</span>
          <span style="color:var(--muted)"> — ${esc(String(f.response))}</span>
        </div>`).join('')}
      </div>` : ''}`;

    const routingContent = routing ? `
      <p style="margin-bottom:12px">Handler: <code>${esc(String(routing.handler || ''))}</code>
        ${routing.file_ref ? ` in <code>${esc(String(routing.file_ref))}</code>` : ''}</p>
      ${routing.middleware_chain?.length ? `<div style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:6px">Middleware</div>
        ${routing.middleware_chain.map((mw: any) => `<div style="padding:4px 0">
          <code>${esc(String(mw.name))}</code>
          ${mw.purpose ? `<span style="color:var(--muted)"> — ${esc(String(mw.purpose))}</span>` : ''}
        </div>`).join('')}
      </div>` : ''}
      ${routing.steps?.length ? `<div>
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:6px">Execution Steps</div>
        ${routing.steps.map((s: any) => `<div class="step">
          <div class="step-id">${esc(String(s.id))}</div>
          <div style="flex:1">
            <div>${esc(String(s.action || ''))}</div>
            ${s.calls ? `<div class="step-meta"><code>${esc(String(s.calls))}</code></div>` : ''}
            ${s.dependency_ref ? `<div class="step-meta">dep: <code>${esc(String(s.dependency_ref))}</code></div>` : ''}
            ${s.notes ? `<div class="step-meta">${esc(String(s.notes))}</div>` : ''}
          </div>
          ${s.parallel ? '<span class="badge badge-blue">parallel</span>' : ''}
        </div>`).join('')}
      </div>` : ''}` : '<p style="color:var(--muted)">No routing block — business perspective only.</p>';

    const perspTabs = `<div class="persp-tabs">
      <div class="persp-tab ${persp === 'business' ? 'active' : ''}"
           onclick="event.stopPropagation();navigate({operationId:'${op.id}',perspective:'business'})">Business</div>
      <div class="persp-tab ${persp === 'routing' ? 'active' : ''}"
           onclick="event.stopPropagation();navigate({operationId:'${op.id}',perspective:'routing'})"
           style="${!routing ? 'opacity:.5;cursor:not-allowed' : ''}">Routing</div>
    </div>`;

    return `<details class="card" style="margin-bottom:12px" ${isOpen ? 'open' : ''}>
      <summary onclick="navigate({operationId:'${isOpen ? null : op.id}'})" style="display:flex;align-items:center;gap:8px;padding:12px 18px;cursor:pointer;list-style:none">
        <svg width="10" height="10" viewBox="0 0 10 10" style="flex-shrink:0;transition:transform .15s;${isOpen ? 'transform:rotate(90deg)' : ''}"><path d="M2 1l5 4-5 4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
        <strong style="flex:1">${esc(String(op.label || op.id))}</strong>
        ${op.input_shape_ref ? `<code style="font-size:11px">${esc(String(op.input_shape_ref))}</code>` : ''}
        <div style="display:flex;gap:4px">${(op.tags || []).slice(0, 3).map((t: string) => `<span class="badge badge-gray">${esc(String(t))}</span>`).join('')}</div>
      </summary>
      ${isOpen ? `<div style="padding:0 18px 18px;border-top:1px solid var(--border)">
        <div style="padding-top:16px">${perspTabs}</div>
        ${persp === 'business' ? bizContent : routingContent}
      </div>` : ''}
    </details>`;
  }).join('');

  const depsHtml = (svc.dependencies as any[]).map(dep => `
    <tr>
      <td><strong>${esc(String(dep.id || ''))}</strong></td>
      <td><span class="badge badge-gray">${esc(String(dep.kind || ''))}</span></td>
      <td>${esc(String(dep.label || ''))}</td>
      <td style="color:var(--muted)">${dep.interface?.protocol ? `<code>${esc(String(dep.interface.protocol))}</code>` : ''}</td>
    </tr>`).join('');

  const shapesHtml = (svc.dataShapes as any[]).map(ds => `
    <div class="card" style="margin-bottom:10px">
      <div class="card-header">
        <span class="card-title">${esc(String(ds.label || ds.id))}</span>
        <span class="badge badge-gray">${esc(String(ds.kind || ''))}</span>
        <code style="font-size:11px;margin-left:auto">${esc(String(ds.id || ''))}</code>
      </div>
      ${ds.fields?.length ? `<div class="card-body" style="padding:0">
        <table><thead><tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
        <tbody>${(ds.fields || []).map((f: any) => `<tr>
          <td><code>${esc(String(f.name))}</code></td>
          <td><code>${esc(String(f.type))}</code></td>
          <td>${f.required !== false ? '✓' : ''}</td>
          <td style="color:var(--muted)">${esc(String(f.description || ''))}</td>
        </tr>`).join('')}</tbody></table>
      </div>` : ''}
    </div>`).join('');

  document.getElementById('main')!.innerHTML = `
    <div style="margin-bottom:20px">
      ${m.description ? `<p style="color:var(--muted);max-width:720px">${esc(String(m.description))}</p>` : ''}
      <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
        ${m.domain ? `<span class="badge badge-blue">${m.domain}</span>` : ''}
        ${m.technology?.language ? `<span class="badge badge-gray">${m.technology.language}${m.technology.framework ? ' / ' + m.technology.framework : ''}</span>` : ''}
      </div>
    </div>

    <section style="margin-bottom:28px">
      <h2 style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:12px">Entry Points</h2>
      <div class="card"><div class="card-body" style="padding:0">
        <table><thead><tr><th>ID</th><th>Kind</th><th>Interface</th><th>Operation</th></tr></thead>
        <tbody>${epRows}</tbody></table>
      </div></div>
    </section>

    <section style="margin-bottom:28px">
      <h2 style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:12px">Operations</h2>
      ${opsHtml}
    </section>

    <section style="margin-bottom:28px">
      <h2 style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:12px">Dependencies</h2>
      <div class="card"><div class="card-body" style="padding:0">
        <table><thead><tr><th>ID</th><th>Kind</th><th>Label</th><th>Protocol</th></tr></thead>
        <tbody>${depsHtml}</tbody></table>
      </div></div>
    </section>

    <section>
      <h2 style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:12px">Data Shapes</h2>
      ${shapesHtml}
    </section>`;
}
