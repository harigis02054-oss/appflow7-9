export type WorkerJobType = "build" | "upload" | "retention_prune";
export type WorkerJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface WorkerJob {
  id: string;
  type: WorkerJobType;
  status: WorkerJobStatus;
  payload: Record<string, unknown>;
  timeoutMs: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  result?: unknown;
}

export interface WorkerQueueStats {
  concurrencyLimit: number;
  runningCount: number;
  queuedCount: number;
  completedCount: number;
  failedCount: number;
}
