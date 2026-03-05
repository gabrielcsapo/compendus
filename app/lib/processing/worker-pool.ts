/**
 * Worker pool for CPU-intensive processing tasks
 * Maintains a pool of persistent worker threads to avoid startup overhead.
 * Tasks are dispatched to idle workers or queued until one becomes available.
 */
import { Worker } from "worker_threads";
import { cpus } from "os";
import { join } from "path";
import { existsSync } from "fs";
import type { WorkerTask, WorkerResult, WorkerTaskType } from "./processing-worker";
import type { BookFormat } from "../types";

interface PendingTask {
  task: WorkerTask;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
}

interface WorkerState {
  worker: Worker;
  busy: boolean;
}

let taskIdCounter = 0;

function getWorkerPath(): string | null {
  const distWorkerPath = join(process.cwd(), "dist/worker/processing-worker.mjs");
  if (existsSync(distWorkerPath)) {
    return distWorkerPath;
  }
  return null;
}

class WorkerPool {
  private workers: WorkerState[] = [];
  private pendingTasks: Map<string, { resolve: (r: unknown) => void; reject: (e: Error) => void }> =
    new Map();
  private taskQueue: PendingTask[] = [];
  private poolSize: number;
  private workerPath: string;

  constructor(poolSize?: number) {
    const path = getWorkerPath();
    if (!path) {
      throw new Error("Processing worker not built. Run 'pnpm run build:worker' first.");
    }
    this.workerPath = path;
    this.poolSize = poolSize ?? Math.max(2, Math.min(4, cpus().length - 1));
    this.initWorkers();
  }

  private initWorkers(): void {
    for (let i = 0; i < this.poolSize; i++) {
      this.addWorker();
    }
    console.log(`[WorkerPool] Initialized with ${this.poolSize} workers`);
  }

  private addWorker(): void {
    const worker = new Worker(this.workerPath);
    const state: WorkerState = { worker, busy: false };

    worker.on("message", (result: WorkerResult) => {
      const pending = this.pendingTasks.get(result.id);
      if (pending) {
        this.pendingTasks.delete(result.id);
        if (result.success) {
          pending.resolve(result.result);
        } else {
          pending.reject(new Error(result.error || "Worker task failed"));
        }
      }

      state.busy = false;
      this.processQueue();
    });

    worker.on("error", (error) => {
      console.error("[WorkerPool] Worker error:", error);
      // Reject all pending tasks for this worker
      state.busy = false;
      // Replace the dead worker
      const idx = this.workers.indexOf(state);
      if (idx !== -1) {
        this.workers.splice(idx, 1);
        this.addWorker();
      }
    });

    worker.on("exit", (code) => {
      if (code !== 0) {
        console.error(`[WorkerPool] Worker exited with code ${code}`);
        const idx = this.workers.indexOf(state);
        if (idx !== -1) {
          this.workers.splice(idx, 1);
          this.addWorker();
        }
      }
    });

    this.workers.push(state);
  }

  private processQueue(): void {
    while (this.taskQueue.length > 0) {
      const idleWorker = this.workers.find((w) => !w.busy);
      if (!idleWorker) break;

      const pending = this.taskQueue.shift()!;
      this.dispatchToWorker(idleWorker, pending);
    }
  }

  private dispatchToWorker(state: WorkerState, pending: PendingTask): void {
    state.busy = true;
    this.pendingTasks.set(pending.task.id, {
      resolve: pending.resolve,
      reject: pending.reject,
    });

    // Transfer buffer as Transferable for zero-copy
    const bufferCopy = Buffer.from(pending.task.buffer);
    state.worker.postMessage({ ...pending.task, buffer: bufferCopy }, [bufferCopy.buffer]);
  }

  async runTask(type: WorkerTaskType, buffer: Buffer, format: BookFormat): Promise<unknown> {
    const id = `task-${++taskIdCounter}`;
    const task: WorkerTask = { id, type, buffer, format };

    return new Promise<unknown>((resolve, reject) => {
      const pending: PendingTask = { task, resolve, reject };
      const idleWorker = this.workers.find((w) => !w.busy);

      if (idleWorker) {
        this.dispatchToWorker(idleWorker, pending);
      } else {
        this.taskQueue.push(pending);
      }
    });
  }

  async shutdown(): Promise<void> {
    const terminations = this.workers.map((state) => state.worker.terminate());
    await Promise.all(terminations);
    this.workers = [];
    this.taskQueue = [];
    this.pendingTasks.clear();
    console.log("[WorkerPool] Shut down");
  }
}

// Singleton pool instance
let pool: WorkerPool | null = null;

export function getWorkerPool(): WorkerPool {
  if (!pool) {
    pool = new WorkerPool();
  }
  return pool;
}

export function isWorkerAvailable(): boolean {
  return getWorkerPath() !== null;
}
