declare const SDL: any;
import { state } from './state.js';
import { esc } from './utils.js';
import { renderMermaid } from './mermaid.js';

export function renderServiceFlows(): void {
  const bundle = (SDL.serviceFlowBundles as any[])[state.flowBundleIdx];
  if (!bundle) { document.getElementById('main')!.innerHTML = '<p>No service flow data found.</p>'; return; }

  const flowsHtml = bundle.flows.map((flow: any) => {
    const steps: any[] = flow.steps || [];
    const actors = new Set<string>(steps.flatMap((s: any) => [s.from_service, s.to_service]).filter(Boolean));

    let seq = 'sequenceDiagram\n';
    const actorAlias = (id: string) => id.replace(/-/g, '_');
    const trigger = flow.trigger;
    if (trigger?.actor && !actors.has(trigger.actor)) actors.add(trigger.actor);
    for (const a of actors) {
      const label = (SDL.platforms[0] as any)?.services?.find((s: any) => s.id === a)?.label ?? a;
      seq += `  participant ${actorAlias(a)} as ${label}\n`;
    }
    let parallelOpen = false;
    for (const step of steps) {
      const from = actorAlias(step.from_service);
      const to = actorAlias(step.to_service);
      const arrow = step.style === 'async' ? '-->>' : '->>';
      const lbl = String(step.label || '').replace(/"/g, "'");
      if (step.parallel && !parallelOpen) { seq += '  par\n'; parallelOpen = true; }
      else if (!step.parallel && parallelOpen) { seq += '  end\n'; parallelOpen = false; }
      seq += `  ${from}${arrow}${to}: ${lbl}\n`;
    }
    if (parallelOpen) seq += '  end\n';

    const stepsHtml = steps.map((s: any) => {
      const from = (SDL.platforms[0] as any)?.services?.find((sv: any) => sv.id === s.from_service)?.label ?? s.from_service;
      const to = (SDL.platforms[0] as any)?.services?.find((sv: any) => sv.id === s.to_service)?.label ?? s.to_service;
      const styleIcon = s.style === 'async' ? '⇢' : '→';
      const protoBadge = s.protocol ? `<span class="badge badge-gray">${s.protocol}</span>` : '';
      const asyncBadge = s.style === 'async' ? '<span class="badge badge-blue">async</span>' : '';
      return `<div class="step">
        <div class="step-id">${s.id}</div>
        <div style="flex:1">
          <div style="font-weight:500">${esc(String(s.label || ''))} ${protoBadge} ${asyncBadge}</div>
          <div class="step-arrow">${esc(String(from))} ${styleIcon} ${esc(String(to))}</div>
          ${s.notes ? `<div class="step-meta" style="margin-top:4px">${esc(String(s.notes))}</div>` : ''}
        </div>
      </div>`;
    }).join('');

    const biz = flow.business || {};
    const diagramId = 'flow-' + flow.id;

    return `<details class="card" style="margin-bottom:16px" open>
      <summary class="card-header" style="border-bottom:none">
        <div style="flex:1">
          <span class="card-title">${esc(String(flow.label || flow.id))}</span>
          ${(flow.tags || []).includes('critical-path') ? ' <span class="badge badge-amber">critical-path</span>' : ''}
        </div>
      </summary>
      <div class="card-body" style="border-top:1px solid var(--border)">
        ${biz.summary ? `<p style="margin-bottom:16px">${esc(String(biz.summary))}</p>` : ''}
        <div class="mermaid-wrap"><div id="${diagramId}"></div></div>
        <div style="margin-top:16px">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px">Steps</div>
          ${stepsHtml}
        </div>
        ${biz.failure_modes?.length ? `<div style="margin-top:16px">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px">Failure Modes</div>
          ${biz.failure_modes.map((f: any) => `<div style="padding:6px 0;border-bottom:1px solid var(--border)">
            <span style="font-weight:500">${esc(String(f.condition))}</span>
            <span style="color:var(--muted)"> — ${esc(String(f.response))}</span>
          </div>`).join('')}
        </div>` : ''}
      </div>
    </details>`;
  }).join('');

  document.getElementById('main')!.innerHTML = flowsHtml;

  bundle.flows.forEach((flow: any) => {
    const steps: any[] = flow.steps || [];
    const actors = new Set<string>(steps.flatMap((s: any) => [s.from_service, s.to_service]).filter(Boolean));
    const actorAlias = (id: string) => id.replace(/-/g, '_');
    let seq = 'sequenceDiagram\n';
    for (const a of actors) {
      const label = (SDL.platforms[0] as any)?.services?.find((s: any) => s.id === a)?.label ?? a;
      seq += `  participant ${actorAlias(a)} as ${label}\n`;
    }
    let parallelOpen = false;
    for (const step of steps) {
      const from = actorAlias(step.from_service);
      const to = actorAlias(step.to_service);
      const arrow = step.style === 'async' ? '-->>' : '->>';
      const lbl = String(step.label || '').replace(/"/g, "'");
      if (step.parallel && !parallelOpen) { seq += '  par\n'; parallelOpen = true; }
      else if (!step.parallel && parallelOpen) { seq += '  end\n'; parallelOpen = false; }
      seq += `  ${from}${arrow}${to}: ${lbl}\n`;
    }
    if (parallelOpen) seq += '  end\n';
    renderMermaid('flow-' + flow.id, seq);
  });
}
