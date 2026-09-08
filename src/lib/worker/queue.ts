import crypto from "crypto";
import type { WorkerJob, WorkerJobType, WorkerJobStatus, WorkerQueueStats } from "./types";

class InMemoryWorkerQueue {
  private jobs: Map<string, WorkerJob> = new Map();
  private concurrencyLimit = 2;
  private runningCount = 0;
  private queue: string[] = [];
  private jobTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(concurrency = 2) {
    this.concurrencyLimit = concurrency;
  }

  public enqueueJob(
    type: WorkerJobType,
    payload: Record<string, unknown>,
    options?: { timeoutMs?: number }
  ): WorkerJob {
    const id = `job_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    const timeoutMs = options?.timeoutMs ?? 15 * 60 * 1000; // 15 mins default

    const job: WorkerJob = {
      id,
      type,
      status: "queued",
      payload,
      timeoutMs,
      createdAt: new Date().toISOString(),
    };

    this.jobs.set(id, job);
    this.queue.push(id);
    this.processNext();

    return job;
  }

  public getJob(id: string): WorkerJob | null {
    return this.jobs.get(id) || null;
  }

  public listJobs(limit = 20): WorkerJob[] {
    return Array.from(this.jobs.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  public cancelJob(id: string, reason = "Cancelled by user"): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;

    if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
      return false;
    }

    const timer = this.jobTimeouts.get(id);
    if (timer) {
      clearTimeout(timer);
      this.jobTimeouts.delete(id);
    }

    if (job.status === "running") {
      this.runningCount = Math.max(0, this.runningCount - 1);
    } else {
      this.queue = this.queue.filter((jobId) => jobId !== id);
    }

    job.status = "cancelled";
    job.completedAt = new Date().toISOString();
    job.error = reason;

    this.processNext();
    return true;
  }

  public getStats(): WorkerQueueStats {
    let completedCount = 0;
    let failedCount = 0;

    for (const job of this.jobs.values()) {
      if (job.status === "completed") completedCount++;
      if (job.status === "failed") failedCount++;
    }

    return {
      concurrencyLimit: this.concurrencyLimit,
      runningCount: this.runningCount,
      queuedCount: this.queue.length,
      completedCount,
      failedCount,
    };
  }

  public markJobComplete(id: string, result?: unknown): void {
    const job = this.jobs.get(id);
    if (!job || job.status !== "running") return;

    const timer = this.jobTimeouts.get(id);
    if (timer) {
      clearTimeout(timer);
      this.jobTimeouts.delete(id);
    }

    this.runningCount = Math.max(0, this.runningCount - 1);
    job.status = "completed";
    job.completedAt = new Date().toISOString();
    job.result = result;

    this.processNext();
  }

  public markJobFailed(id: string, error: string): void {
    const job = this.jobs.get(id);
    if (!job || job.status !== "running") return;

    const timer = this.jobTimeouts.get(id);
    if (timer) {
      clearTimeout(timer);
      this.jobTimeouts.delete(id);
    }

    this.runningCount = Math.max(0, this.runningCount - 1);
    job.status = "failed";
    job.completedAt = new Date().toISOString();
    job.error = error;

    this.processNext();
  }

  private processNext(): void {
    if (this.runningCount >= this.concurrencyLimit || this.queue.length === 0) {
      return;
    }

    const nextId = this.queue.shift();
    if (!nextId) return;

    const job = this.jobs.get(nextId);
    if (!job || job.status !== "queued") {
      this.processNext();
      return;
    }

    this.runningCount++;
    job.status = "running";
    job.startedAt = new Date().toISOString();

    // Set timeout timer
    const timer = setTimeout(() => {
      this.markJobFailed(job.id, `Job timed out after ${job.timeoutMs / 1000}s.`);
    }, job.timeoutMs);

    this.jobTimeouts.set(job.id, timer);
  }
}

// Global worker queue instance
export const globalWorkerQueue = new InMemoryWorkerQueue(2);
