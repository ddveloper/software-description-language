declare const SDL: any;
import { state, OV, navigate, setNavigateImpl } from './state.js';
import { renderTopBar } from './topbar.js';
import { renderPlatform } from './platform.js';
import { renderServiceFlows } from './service-flows.js';
import { renderLayerLogic } from './logic-layer.js';
import { renderOverview } from './overview/index.js';
import { stopPlayback, togglePlayback, setPlaybackSpeed } from './overview/playback.js';
import { togOv, saveOvLayout, loadOvLayout } from './overview/ui.js';
import { resetOvView } from './overview/events.js';
import { switchOvSublayer } from './overview/sublayer.js';
import { toggleActiveFlow, toggleActiveOperation } from './overview/panels.js';
import { initMermaid } from './mermaid.js';

// ── Mermaid ───────────────────────────────────────────────────────────────────
initMermaid();

// ── Main render loop ──────────────────────────────────────────────────────────
function render(): void {
  renderTopBar();
  const main = document.getElementById('main');
  if (main) main.className = state.layer === 'overview' ? 'ov-full' : '';
  switch (state.layer) {
    case 'platform':      renderPlatform();     break;
    case 'service_flows': renderServiceFlows(); break;
    case 'layer_logic':   renderLayerLogic();   break;
    case 'overview':      renderOverview();     break;
    default:              renderPlatform();
  }
}

// ── Wire navigate implementation ──────────────────────────────────────────────
setNavigateImpl((patch: any) => {
  if (patch.layer && patch.layer !== 'overview' && state.layer === 'overview') {
    stopPlayback();
    clearTimeout(OV._zoomTimer as any);
    OV._zoomTimer = null;
  }
  Object.assign(state, patch);
  render();
});

// ── Expose globals for inline HTML event handlers ────────────────────────────
const w = window as any;
w.navigate              = navigate;
w.togOv                 = togOv;
w.resetOvView           = resetOvView;
w.saveOvLayout          = saveOvLayout;
w.loadOvLayout          = loadOvLayout;
w.switchOvSublayer      = switchOvSublayer;
w.toggleActiveFlow      = toggleActiveFlow;
w.toggleActiveOperation = toggleActiveOperation;
w.togglePlayback        = togglePlayback;
w.setPlaybackSpeed      = setPlaybackSpeed;
w.renderOverview        = renderOverview;
w.OV                    = OV;
w.__sdlNavService       = (id: string) => navigate({ layer: 'layer_logic', serviceId: id } as any);

// ── Boot ──────────────────────────────────────────────────────────────────────
(function init() {
  if ((SDL.platforms as any[]).length || (SDL.services as any[]).length) state.layer = 'overview';
  else if ((SDL.serviceFlowBundles as any[]).length) state.layer = 'service_flows';
  render();
})();

// ── Overview keyboard shortcuts ───────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
  if (state.layer !== 'overview') return;
  const map: Record<string, string> = { d: 'domains', c: 'connections', k: 'kinds', t: 'tags', f: 'flows' };
  const key = e.key.toLowerCase();
  if (map[key]) { togOv(map[key]); e.preventDefault(); return; }
  if (key === 'r') { resetOvView(); e.preventDefault(); }
});
