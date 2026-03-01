declare const SDL: any;
import { OV } from '../state.js';
import { esc } from '../utils.js';
import { persistOvLayout } from './events.js';

export function togOv(key: string): void {
  OV.toggles[key] = !OV.toggles[key];
  applyOvToggles();
  const btn = document.getElementById('tb-' + key);
  if (btn) btn.className = 'tog-btn' + (OV.toggles[key] ? ' on' : '');
  persistOvLayout();
}

export function applyOvToggles(): void {
  [['domains', 'ov-domains'], ['connections', 'ov-edges'], ['flows', 'ov-flows']].forEach(([k, id]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = OV.toggles[k] ? '' : 'none';
  });
  document.querySelectorAll('.ov-kind').forEach(el => { (el as HTMLElement).style.display = OV.toggles.kinds ? '' : 'none'; });
  document.querySelectorAll('.ov-tags').forEach(el => { (el as HTMLElement).style.display = OV.toggles.tags ? '' : 'none'; });
}

export function updateOvSublayerUI(): void {
  const crumb = document.getElementById('ov-sublayer-crumb');
  const backBtn = document.getElementById('ov-back-btn');
  if (!crumb) return;

  const badge = (text: string, color: string) =>
    `<span style="background:${color};color:#fff;font-size:10px;font-weight:600;padding:2px 7px;border-radius:99px;text-transform:uppercase;letter-spacing:.05em;margin-right:6px;flex-shrink:0">${esc(text)}</span>`;

  if (OV.sublayer === 'macro') {
    crumb.innerHTML = badge('Platform', '#6366f1') + 'Overview';
    if (backBtn) backBtn.style.display = 'none';
  } else if (OV.sublayer === 'micro') {
    const svc = (SDL.services as any[]).find(s => s.serviceId === OV.focusedSvc);
    const label = svc?.manifest?.label || OV.focusedSvc || 'Service';
    crumb.innerHTML = `${badge('Service', '#3b82f6')}<span onclick="switchOvSublayer('meso')" style="cursor:pointer;color:var(--accent)">All Services</span> › ${esc(String(label))}`;
    if (backBtn) backBtn.style.display = '';
  } else {
    crumb.innerHTML = badge('Meso', '#10b981') + 'All Services';
    if (backBtn) backBtn.style.display = 'none';
  }
}

export function saveOvLayout(): void {
  persistOvLayout();
  // Build file with same format as persistOvLayout for full fidelity
  const mesoPos = OV.sublayer === 'meso' ? OV.positions : OV._mesoPositions;
  const layout = {
    sdlLayoutVersion: 2, zoom: OV.zoom, panX: OV.panX, panY: OV.panY,
    positions: mesoPos, mesoPositions: mesoPos,
    macroPositions: OV._macroPositions, toggles: OV.toggles,
  };
  const blob = new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sdl-layout.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

export function loadOvLayout(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const l = JSON.parse((ev.target as FileReader).result as string);
      if (l.sdlLayoutVersion >= 1) {
        OV.zoom = l.zoom || 1; OV.panX = l.panX || 40; OV.panY = l.panY || 40;
        const meso = l.mesoPositions || l.positions || {};
        Object.assign(OV.positions, meso);
        Object.assign(OV._mesoPositions, meso);
        Object.assign(OV._macroPositions, l.macroPositions || {});
        Object.assign(OV.toggles, l.toggles || {});
        // Call renderOverview via window to avoid circular dep
        (window as any).renderOverview?.();
        persistOvLayout();
      }
    } catch (err) { alert('Invalid layout file: ' + (err as Error).message); }
  };
  reader.readAsText(file);
}
