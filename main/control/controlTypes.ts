export type ControlTaskAction = 'start' | 'pause' | 'cancel' | 'retry' | 'observe';

export interface ControlTaskCommand {
  commandId: string;
  requestId: string;
  action: ControlTaskAction;
  projectId: string;
  batchId: string;
  taskId: string;
}

export interface ControlCommandResult {
  commandId: string;
  ok: boolean;
  code: string;
  accepted?: boolean;
}
