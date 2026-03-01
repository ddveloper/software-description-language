import { OV } from '../state.js';

export function togglePlayback(): void {
  if (OV.playback.playing) stopPlayback(); else startPlayback();
}

export function startPlayback(): void {
  const steps = OV.playback.allSteps;
  if (!steps.length) return;
  OV.playback.playing = true;
  const btn = document.getElementById('ov-play-btn');
  if (btn) btn.textContent = '⏸ Pause';
  if (OV.playback.stepIdx >= steps.length) OV.playback.stepIdx = 0;
  highlightPlaybackStep(OV.playback.stepIdx);
  OV.playback.timer = setInterval(() => {
    OV.playback.stepIdx++;
    if (OV.playback.stepIdx >= OV.playback.allSteps.length) {
      if (OV.playback.repeat) OV.playback.stepIdx = 0;
      else { stopPlayback(); return; }
    }
    highlightPlaybackStep(OV.playback.stepIdx);
  }, OV.playback.speed);
}

export function stopPlayback(): void {
  OV.playback.playing = false;
  if (OV.playback.timer) { clearInterval(OV.playback.timer); OV.playback.timer = null; }
  const btn = document.getElementById('ov-play-btn');
  if (btn) btn.textContent = '▶ Play';
  document.querySelectorAll('.ov-node-active').forEach(el => el.classList.remove('ov-node-active'));
  document.querySelectorAll('.ov-step-item.playing').forEach(el => el.classList.remove('playing'));
  document.querySelectorAll('.ov-edge-active').forEach(el => {
    el.classList.remove('ov-edge-active');
    el.setAttribute('stroke', (el as HTMLElement).dataset.origStroke || '#94a3b8');
    el.setAttribute('stroke-width', '1.5');
  });
}

export function highlightPlaybackStep(idx: number): void {
  document.querySelectorAll('.ov-node-active').forEach(el => el.classList.remove('ov-node-active'));
  document.querySelectorAll('.ov-step-item.playing').forEach(el => el.classList.remove('playing'));
  document.querySelectorAll('.ov-edge-active').forEach(el => {
    el.classList.remove('ov-edge-active');
    el.setAttribute('stroke', (el as HTMLElement).dataset.origStroke || '#94a3b8');
    el.setAttribute('stroke-width', '1.5');
  });
  const steps = OV.playback.allSteps;
  if (idx < 0 || idx >= steps.length) return;
  const { step } = steps[idx];
  if (step.from_service) {
    const n = document.querySelector(`.ov-node[data-id="${step.from_service}"]`);
    if (n) n.classList.add('ov-node-active');
  }
  if (step.to_service) {
    const n = document.querySelector(`.ov-node[data-id="${step.to_service}"]`);
    if (n) n.classList.add('ov-node-active');
  }
  const edge = document.querySelector(`#ov-flows .ov-edge-vis[data-from="${step.from_service}"][data-to="${step.to_service}"]`)
             || document.querySelector(`#ov-edges .ov-edge-vis[data-from="${step.from_service}"][data-to="${step.to_service}"]`);
  if (edge) {
    if (!(edge as HTMLElement).dataset.origStroke) (edge as HTMLElement).dataset.origStroke = edge.getAttribute('stroke') || '';
    edge.setAttribute('stroke', '#3b82f6');
    edge.setAttribute('stroke-width', '3');
    edge.classList.add('ov-edge-active');
  }
  const stepEl = document.querySelector(`.ov-step-item[data-step="${idx}"]`);
  if (stepEl) { stepEl.classList.add('playing'); stepEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
}

export function setPlaybackSpeed(val: string | number): void {
  OV.playback.speed = Number(val);
  const lbl = document.getElementById('ov-speed-lbl');
  if (lbl) lbl.textContent = val + 'ms';
  if (OV.playback.playing) {
    clearInterval(OV.playback.timer!);
    OV.playback.timer = setInterval(() => {
      OV.playback.stepIdx++;
      if (OV.playback.stepIdx >= OV.playback.allSteps.length) {
        if (OV.playback.repeat) OV.playback.stepIdx = 0;
        else { stopPlayback(); return; }
      }
      highlightPlaybackStep(OV.playback.stepIdx);
    }, OV.playback.speed);
  }
}
