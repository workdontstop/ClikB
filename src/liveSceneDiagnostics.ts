type Entry = { time: string; event: string; details: Record<string, string | number | boolean | undefined> };
const entries: Entry[] = [];
const safeText = (text: string) => text
    .replace(/https?:\/\/[^\s"']+/gi, '[url]')
    .replace(/(?:Bearer\s+\S+|[\w.+-]+@[\w.-]+\.[a-z]{2,})/gi, '[redacted]')
    .replace(/(?:sk-[\w-]+|r8_[\w-]+|eyJ[\w-]+\.[\w-]+\.[\w-]+)/g, '[redacted]')
    .slice(0, 350);
// Call sites supply metadata only. Never pass request bodies, scene targets or headers.
export function liveSceneLog(event: string, details: Entry['details'] = {}) {
    const entry = { time: new Date().toISOString(), event,
        details: Object.fromEntries(Object.entries(details).map(([key, value]) => [key, typeof value === 'string' ? safeText(value) : value])) };
    entries.push(entry);
    if (entries.length > 300) entries.shift();
    console.info('[ThreeJS] ' + JSON.stringify(entry));
}
export const exportLiveSceneLogs = () => {
    const lastError = [...entries].reverse().find(e => e.event === 'server-error' || e.event === 'request-error' || Boolean(e.details?.error));
    const start = entries.find(e => e.event === 'request-start');
    const summary = {
        totalEntries: entries.length,
        startTime: start?.time,
        lastError: lastError ? { time: lastError.time, event: lastError.event, details: lastError.details } : null,
        recentEvents: entries.slice(-6).map(e => `${e.time.slice(11, 19)} [${e.event}] ${String(e.details?.message || e.details?.stage || e.details?.code || '')}`.trim()),
    };
    return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), summary, entries }, null, 2);
};
export async function copyLiveSceneLogs(): Promise<'Copied' | 'Downloaded'> {
    const text = exportLiveSceneLogs();
    try { await navigator.clipboard.writeText(text); return 'Copied'; }
    catch {
        const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = 'three-js-build-logs.json';
        link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        return 'Downloaded';
    }
}
if (typeof window !== 'undefined') (window as any).__threeJsDiagnostics = { export: exportLiveSceneLogs };
