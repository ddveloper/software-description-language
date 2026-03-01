declare const SDL: any;
import { state, navigate } from './state.js';
import { esc } from './utils.js';

export function renderTopBar(): void {
  const tabs = document.getElementById('layer-tabs')!;
  const available: { id: string; label: string }[] = [];
  if (SDL.platforms.length || SDL.services.length) available.push({ id: 'overview', label: 'Overview' });
  if (SDL.platforms.length) available.push({ id: 'platform', label: 'Platform' });
  if (SDL.serviceFlowBundles.length) available.push({ id: 'service_flows', label: 'Service Flows' });
  if (SDL.services.length) available.push({ id: 'layer_logic', label: 'Service Logic' });

  tabs.innerHTML = available.map(t =>
    `<div class="tab ${state.layer === t.id ? 'active' : ''}"
          onclick="navigate({layer:'${t.id}', serviceId: null, operationId: null})">${t.label}</div>`
  ).join('');

  const bc = document.getElementById('breadcrumb')!;
  const crumbs: string[] = [];
  if (state.layer === 'layer_logic' && state.serviceId) {
    const svc = SDL.services.find((s: any) => s.serviceId === state.serviceId);
    const label = svc ? svc.manifest.label : state.serviceId;
    crumbs.push(`<span class="crumb" onclick="navigate({layer:'platform',serviceId:null})">${SDL.platforms[0]?.label ?? 'Platform'}</span>`);
    crumbs.push(`<span>›</span><strong>${esc(String(label))}</strong>`);
  }
  bc.innerHTML = crumbs.join(' ');
}
