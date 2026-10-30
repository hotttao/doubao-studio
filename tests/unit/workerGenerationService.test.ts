import { describe, expect, it } from 'vitest';
import type { Task } from '@doubao-studio/contracts';
import { WorkerGenerationService, type WorkerGenerationInput } from '../../main/core/WorkerGenerationService';

const key = 'a'.repeat(64);
const input: WorkerGenerationInput = { prompt: 'rendered private prompt', images: ['/private/frame.png'], model: 'seedance-2.0-fast', duration: '5s', aspectRatio: '9:16', accountId: 'account-1' };
function fixture(): { service: WorkerGenerationService; restart: () => WorkerGenerationService; read: () => Task[] } {
  let data: Task[] = [];
  const store = { read: (): Task[] => structuredClone(data), replace: (next: Task[]): boolean => { data = structuredClone(next); return true; } };
  return { service: new WorkerGenerationService(store), restart: () => new WorkerGenerationService(store), read: (): Task[] => data };
}
describe('Worker stable generation identity', () => {
  it('reuses the exact persisted task after restart and refuses different input', () => {
    const { service, restart, read } = fixture();
    const first = service.ensure(key, input);
    const restored = restart().ensure(key, input);
    expect(restored.id).toBe(first.id);
    expect(read()).toHaveLength(1);
    expect(() => restart().ensure(key, { ...input, prompt: 'different' })).toThrow('WORKER_KEY_CONFLICT');
    expect(restored.executionIntent).toBe('hold');
  });
  it('persists start and confirmation intent once across service restarts', () => {
    const { service, restart, read } = fixture(); service.ensure(key, input);
    expect(service.claim(key, 'startIntentAt')).toBe(true);
    expect(restart().claim(key, 'startIntentAt')).toBe(false);
    expect(service.claim(key, 'confirmationIntentAt')).toBe(true);
    expect(restart().claim(key, 'confirmationIntentAt')).toBe(false);
    expect(read()[0].workerBinding?.confirmationIntentAt).toBeTruthy();
  });
  it('does not invent absence on repository failure and rejects unsupported shapes', () => {
    const unavailable = new WorkerGenerationService({ read: (): Task[] => { throw new Error('corrupt'); }, replace: (): boolean => false });
    expect(() => unavailable.lookup(key)).toThrow('corrupt');
    const { service } = fixture();
    expect(() => service.ensure(key, { ...input, images: [] })).toThrow('INVALID_WORKER_INPUT');
    expect(() => service.ensure(key, { ...input, model: 'unknown' as WorkerGenerationInput['model'] })).toThrow('INVALID_WORKER_INPUT');
  });
});

it('preserves ordered multiple attachments and binds their order to the stable key', (): void => {
 const {service,restart,read}=fixture();
 const request={...input, images:['/private/first.png','/private/second.png']};
 const task=service.ensure(key,request);
 expect(task.attachments).toEqual(request.images);
 expect(restart().ensure(key,request).id).toBe(task.id);
 expect(read()).toHaveLength(1);
 expect(()=>restart().ensure(key,{...request,images:[...request.images].reverse()})).toThrow('WORKER_KEY_CONFLICT');
 expect(()=>restart().ensure('b'.repeat(64),{...request,images:['valid','']})).toThrow('INVALID_WORKER_INPUT');
});
