import { describe, expect, it, vi } from 'vitest';
import { dispatchWorkerConfirmation, type ConfirmationTarget } from '../../main/control/WorkerConfirmation';
const url = 'https://www.doubao.com/chat/exact';
function fixture(focus = true): { target: ConfirmationTarget; sent: Array<{ method: string; params: Record<string, unknown> }>; events: string[]; claim: () => boolean } {
  const sent: Array<{ method: string; params: Record<string, unknown> }> = []; const events: string[] = [];
  const target = { getURL: (): string => url, executeJavaScript: vi.fn(async (): Promise<boolean> => focus), debugger: {
    isAttached: (): boolean => true, attach: (): void => {}, detach: (): void => {},
    sendCommand: async (method: string, params: Record<string, unknown>): Promise<void> => { events.push('input'); sent.push({ method, params }); },
  } } as unknown as ConfirmationTarget;
  return { target, sent, events, claim: (): boolean => { events.push('persist-intent'); return true; } };
}
describe('exact-session parameter confirmation', () => {
  it('persists intent before trusted input and uses native Enter only after focus/readback', async () => {
    const f = fixture(); await dispatchWorkerConfirmation(f.target, url, { x: 20, y: 30 }, f.claim);
    expect(f.events[0]).toBe('persist-intent');
    expect(f.sent.some((s) => s.method === 'Input.dispatchKeyEvent' && s.params.type === 'rawKeyDown')).toBe(true);
  });
  it('never sends Enter when the input focus cannot be confirmed', async () => {
    const f = fixture(false); await expect(dispatchWorkerConfirmation(f.target, url, { x: 20, y: 30 }, f.claim)).rejects.toThrow('NOT_FOCUSED');
    expect(f.sent.some((s) => s.method === 'Input.insertText' || s.method === 'Input.dispatchKeyEvent')).toBe(false);
  });
  it('does not repeat a previously claimed confirmation or act on another conversation', async () => {
    const f = fixture(); await dispatchWorkerConfirmation(f.target, url, { x: 20, y: 30 }, (): boolean => false);
    expect(f.sent).toHaveLength(0);
    await expect(dispatchWorkerConfirmation(f.target, url + '-other', { x: 20, y: 30 }, f.claim)).rejects.toThrow('CONVERSATION_CHANGED');
    expect(f.sent).toHaveLength(0);
  });
});
