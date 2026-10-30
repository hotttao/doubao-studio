import { createHash } from 'crypto';
import type { Task, VideoModel, VideoAspectRatio, VideoDuration } from '@doubao-studio/contracts';
import type { TaskStore } from './TaskService';

export interface WorkerGenerationInput {
  prompt: string;
  images: string[];
  model: VideoModel;
  duration: VideoDuration;
  aspectRatio: VideoAspectRatio;
  accountId: string;
}
export class WorkerGenerationService {
  constructor(private readonly store: TaskStore, private readonly now: () => string = () => new Date().toISOString()) {}
  lookup(key: string): Task | null {
    const tasks = this.store.read();
    const task = tasks.find((item) => item.id === `worker-${key}`);
    if (task && task.workerBinding?.key !== key) throw new Error('WORKER_KEY_CONFLICT');
    return task || null;
  }
  ensure(key: string, input: WorkerGenerationInput): Task {
    if (!/^[a-f0-9]{64}$/.test(key) || typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > 12000 ||
        !Array.isArray(input.images) || input.images.length === 0 || input.images.some((image) => typeof image !== 'string' || !image.trim()) || !input.accountId ||
        !['seedance-2.5', 'seedance-2.0', 'seedance-2.0-fast', 'seedance-2.0-mini'].includes(input.model) ||
        !/^(?:[4-9]|1[0-5])s$/.test(input.duration) || !['1:1','3:4','4:3','9:16','16:9','21:9'].includes(input.aspectRatio)) {
      throw new Error('INVALID_WORKER_INPUT');
    }
    const digest = createHash('sha256').update(JSON.stringify({ prompt: input.prompt, images: input.images, model: input.model, duration: input.duration, aspectRatio: input.aspectRatio, accountId: input.accountId })).digest('hex');
    const prior = this.lookup(key);
    if (prior) {
      if (prior.workerBinding?.digest !== digest) throw new Error('WORKER_KEY_CONFLICT');
      return prior;
    }
    const tasks = this.store.read();
    const timestamp = this.now();
    const task: Task = {
      id: `worker-${key}`, workerBinding: { key, digest }, projectId: 'default-project', batchId: 'worker',
      prompt: input.prompt, mode: 'video', assignedAccountId: input.accountId,
      status: 'queued', executionIntent: 'hold', source: 'workflow', attachments: [...input.images],
      videoConfig: { model: input.model, duration: input.duration, aspectRatio: input.aspectRatio },
      result: null, outputs: [], artifacts: [], runHistory: [], dependsOnTaskIds: [], createdAt: timestamp, updatedAt: timestamp,
    };
    tasks.push(task);
    if (!this.store.replace(tasks)) throw new Error('WORKER_WRITE_FAILED');
    return task;
  }
  // 先写意图再触发动作；进程退出或响应不确定不允许再次点击/启动。
  claim(key: string, field: 'startIntentAt' | 'confirmationIntentAt'): boolean {
    const tasks = this.store.read();
    const task = tasks.find((item) => item.id === `worker-${key}` && item.workerBinding?.key === key);
    if (!task?.workerBinding) throw new Error('WORKER_NOT_FOUND');
    if (task.workerBinding[field]) return false;
    task.workerBinding[field] = this.now();
    if (!this.store.replace(tasks)) throw new Error('WORKER_WRITE_FAILED');
    return true;
  }
}
