import type { IncomingMessage, ServerResponse } from 'http';
import type { Task } from '@doubao-studio/contracts';
import type { WorkerGenerationInput } from '../core/WorkerGenerationService';
export interface WorkerGenerationAPI {
  lookup: (key: string) => Task | null;
  submit: (key: string, input: WorkerGenerationInput) => Task;
  advance: (key: string) => Promise<void>;
  artifact: (key: string, artifactId: string) => Promise<Buffer>;
}
export async function handleWorkerGeneration(
  req: IncomingMessage, res: ServerResponse, parts: string[], api: WorkerGenerationAPI,
  read: (req: IncomingMessage) => Promise<Record<string, unknown>>,
  send: (res: ServerResponse, status: number, body: Record<string, unknown>) => void,
): Promise<void> {
  const key = parts[3];
  if (!/^[a-f0-9]{64}$/.test(key || '')) { send(res, 400, { ok: false, code: 'INVALID_WORKER_KEY' }); return; }
  try {
    if (req.method === 'PUT' && parts.length === 4) {
      api.submit(key, await read(req) as unknown as WorkerGenerationInput);
    } else if (req.method === 'POST' && parts.length === 5 && parts[4] === 'advance') {
      await api.advance(key);
    } else if (req.method === 'GET' && parts.length === 6 && parts[4] === 'artifacts') {
      const artifactId = parts[5];
      if (!/^[A-Za-z0-9._:-]{1,160}$/.test(artifactId)) throw new Error('INVALID_ARTIFACT');
      const data = await api.artifact(key, artifactId);
      res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': data.length, 'cache-control': 'no-store' });
      res.end(data); return;
    } else if (req.method !== 'GET' || parts.length !== 4) { send(res, 404, { ok: false, code: 'NOT_FOUND' }); return; }
    const task = api.lookup(key);
    if (!task) { send(res, 404, { ok: false, code: 'WORKER_NOT_FOUND', authoritative: true }); return; }
    send(res, 200, { ok: true, reference: key, status: task.status, stage: task.runtime?.stage,
      started: !!task.workerBinding?.startIntentAt, confirmationAttempted: !!task.workerBinding?.confirmationIntentAt,
      errorCode: task.errorInfo?.code, artifacts: (task.artifacts || []).filter((a) => a.kind === 'video').map((a) => ({ id: a.id, kind: 'VIDEO', mediaType: 'video/mp4' })),
    });
  } catch {
    send(res, 409, { ok: false, code: 'WORKER_OPERATION_UNCONFIRMED' });
  }
}
