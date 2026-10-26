import { afterEach, describe, expect, it } from 'vitest';
import type { Task } from '@doubao-studio/contracts';
import { LocalControlServer } from '../../main/control/LocalControlServer';
import type { WorkerGenerationAPI } from '../../main/control/WorkerGenerationRoutes';
const key = 'b'.repeat(64);
const auth = { authorization: 'Bearer worker-local-test' };
const task: Task = { id: `worker-${key}`, prompt: 'private prompt sentinel', mode: 'video', assignedAccountId: 'account', status: 'done', workerBinding: { key, digest: 'digest' }, result: null, outputs: [], artifacts: [{ id: 'exact-video', kind: 'video', url: 'https://private/signed', source: 'network', discoveredAt: 'now' }], createdAt: 'now', updatedAt: 'now' };
describe('Worker generation protocol', () => {
  let server: LocalControlServer;
  afterEach(async (): Promise<void> => { await server?.stop(); });
  async function start(overrides: Partial<WorkerGenerationAPI> = {}): Promise<string> {
    server = new LocalControlServer({ token: 'worker-local-test', expiresAtMs: Date.now() + 60_000, listProjects: () => [], listTasks: () => [], listAccounts: () => [], isRendererReady: () => true,
      dispatch: async () => ({ commandId: '', ok: true, code: 'OK' }), assign: async () => ({ success: true, code: 'OK' }), downloadArtifact: async () => ({ success: true, code: 'OK' }),
      worker: { lookup: () => task, submit: () => task, advance: async (): Promise<void> => {}, artifact: async (): Promise<Buffer> => Buffer.from('exact-media-bytes'), ...overrides },
    }); const port = await server.start(); return `http://127.0.0.1:${port}/v1/worker/generations/${key}`;
  }
  it('returns authoritative absence only after successful lookup', async () => {
    const url = await start({ lookup: () => null });
    const response = await fetch(url, { headers: auth });
    expect(response.status).toBe(404); expect(await response.json()).toMatchObject({ authoritative: true, code: 'WORKER_NOT_FOUND' });
  });
  it('keeps corrupt or uncertain lookup distinct from absence', async () => {
    const url = await start({ lookup: () => { throw new Error('private error'); } });
    const response = await fetch(url, { headers: auth });
    expect(response.status).toBe(409); expect(await response.text()).not.toContain('private error');
  });
  it('sanitizes generation facts and downloads only the exact artifact bytes', async () => {
    const seen: string[] = [];
    const url = await start({ artifact: async (foundKey, artifactId): Promise<Buffer> => { seen.push(foundKey, artifactId); return Buffer.from('exact-media-bytes'); } });
    const projection = await (await fetch(url, { headers: auth })).text();
    expect(projection).not.toContain('private prompt'); expect(projection).not.toContain('https://private');
    const media = await fetch(`${url}/artifacts/exact-video`, { headers: auth });
    expect(await media.text()).toBe('exact-media-bytes'); expect(seen).toEqual([key, 'exact-video']);
    expect((await fetch(url)).status).toBe(401);
  });
});
