import { OV, NODE_W, NODE_H } from '../state.js';

export function initOvLayout(svcs: any[]): void {
  const byDomain = groupByDomain(svcs);
  let x = 60;
  byDomain.forEach(dsvc => {
    let y = 60;
    dsvc.forEach((s: any) => { OV.positions[s.id] = { x, y }; y += NODE_H + 30; });
    x += NODE_W + 80;
  });
}

export function groupByDomain(svcs: any[]): Map<string, any[]> {
  const m = new Map<string, any[]>();
  svcs.forEach(s => {
    const d = s.domain || 'other';
    if (!m.has(d)) m.set(d, []);
    m.get(d)!.push(s);
  });
  return m;
}

export function getDomainBounds(svcs: any[]): { x: number; y: number; w: number; h: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  svcs.forEach((s: any) => {
    const p = OV.positions[s.id];
    if (!p) return;
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + NODE_W); maxY = Math.max(maxY, p.y + NODE_H);
  });
  if (minX === Infinity) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX - 20, y: minY - 28, w: maxX - minX + 40, h: maxY - minY + 48 };
}

export function makeEdgePath(
  fp: { x: number; y: number },
  tp: { x: number; y: number },
  isFlow: boolean
): string {
  const fx = fp.x + NODE_W / 2, fy = fp.y + NODE_H / 2;
  const tx = tp.x + NODE_W / 2, ty = tp.y + NODE_H / 2;
  const dx = tx - fx, dy = ty - fy;
  const off = Math.min(80, Math.max(30, (Math.abs(dx) + Math.abs(dy)) / 4)) + (isFlow ? 24 : 0);
  let x1: number, y1: number, x2: number, y2: number, cpx1: number, cpy1: number, cpx2: number, cpy2: number;
  if (Math.abs(dx) >= Math.abs(dy)) {
    x1 = dx > 0 ? fp.x + NODE_W : fp.x; y1 = fp.y + NODE_H / 2;
    x2 = dx > 0 ? tp.x : tp.x + NODE_W; y2 = tp.y + NODE_H / 2;
    cpx1 = dx > 0 ? x1 + off : x1 - off; cpy1 = y1;
    cpx2 = dx > 0 ? x2 - off : x2 + off; cpy2 = y2;
  } else {
    x1 = fp.x + NODE_W / 2; y1 = dy > 0 ? fp.y + NODE_H : fp.y;
    x2 = tp.x + NODE_W / 2; y2 = dy > 0 ? tp.y : tp.y + NODE_H;
    cpx1 = x1; cpy1 = dy > 0 ? y1 + off : y1 - off;
    cpx2 = x2; cpy2 = dy > 0 ? y2 - off : y2 + off;
  }
  return 'M' + x1 + ',' + y1 + ' C' + cpx1 + ',' + cpy1 + ' ' + cpx2 + ',' + cpy2 + ' ' + x2 + ',' + y2;
}
