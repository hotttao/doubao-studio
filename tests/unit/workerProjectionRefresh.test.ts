import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTaskStore } from '../../src/store/useTaskStore';
import type { Task } from '../../src/types';
describe('Worker task projection refresh', () => {
  afterEach((): void => { vi.unstubAllGlobals(); });
  it('makes externally created tasks visible without resetting running slots', async () => {
    const task: Task = { id: 'external-worker-task', prompt: 'rendered', assignedAccountId: 'account', mode: 'video', status: 'queued', executionIntent: 'hold', result: null, outputs: [], createdAt: 'now', updatedAt: 'now' };
    vi.stubGlobal('window', { electronAPI: { tasks: { list: vi.fn(async (): Promise<Task[]> => [task]) } } });
    useTaskStore.setState({ tasks: [], executingTasks: { existingAccount: 'existingTask' }, accountBusy: { existingAccount: true } });
    expect(await useTaskStore.getState().refreshTasks()).toEqual([task]);
    expect(useTaskStore.getState().tasks[0].id).toBe(task.id);
    expect(useTaskStore.getState().executingTasks).toEqual({ existingAccount: 'existingTask' });
    expect(useTaskStore.getState().accountBusy).toEqual({ existingAccount: true });
  });
});
