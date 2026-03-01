declare const mermaid: any;

export async function renderMermaid(containerId: string, graphDef: string): Promise<void> {
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
  } catch (e) {
    el.textContent = 'Diagram error: ' + (e as Error).message;
  }
}

export function initMermaid(): void {
  if (typeof mermaid !== 'undefined') {
    mermaid.initialize({
      startOnLoad: false, securityLevel: 'loose', theme: 'default',
      flowchart: { useMaxWidth: false, htmlLabels: true },
    });
  }
}
