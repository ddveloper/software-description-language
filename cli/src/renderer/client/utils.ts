declare const SDL: any;

export function esc(s: unknown): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

export function kindIcon(kind?: string): string {
  return ({ frontend: '🖥', external: '🌐', worker: '⚙' } as Record<string, string>)[kind ?? ''] ?? '◈';
}

export function kindForService(svc: any): string {
  const actor = SDL.platforms[0]?.services?.find((s: any) => s.id === svc.serviceId);
  return actor?.kind || 'backend';
}
