/**
 * Simple in-memory job tracking for long-running tasks like audio merging
 */

export interface JobProgress {
  id: string;
  status: "pending" | "running" | "completed" | "error";
  progress: number; // 0-100
  currentTime?: number;
  totalDuration?: number;
  message?: string;
  result?: { bookId?: string; error?: string };
  updatedAt: number;
}

// In-memory job store (jobs expire after 5 minutes)
const jobs = new Map<string, JobProgress>();
const JOB_EXPIRY_MS = 5 * 60 * 1000;

// SSE subscribers per job
const subscribers = new Map<string, Set<(progress: JobProgress) => void>>();

/**
 * Create a new job
 */
export function createJob(id: string): JobProgress {
  const job: JobProgress = {
    id,
    status: "pending",
    progress: 0,
    updatedAt: Date.now(),
  };
  jobs.set(id, job);
  return job;
}

/**
 * Update job progress
 */
export function updateJobProgress(
  id: string,
  updates: Partial<Omit<JobProgress, "id" | "updatedAt">>,
): JobProgress | null {
  const job = jobs.get(id);
  if (!job) return null;

  Object.assign(job, updates, { updatedAt: Date.now() });

  // Notify subscribers
  const subs = subscribers.get(id);
  if (subs) {
    for (const callback of subs) {
      callback(job);
    }
  }

  return job;
}

/**
 * Get job by ID
 */
export function getJob(id: string): JobProgress | null {
  const job = jobs.get(id);
  if (!job) return null;

  // Check if expired
  if (Date.now() - job.updatedAt > JOB_EXPIRY_MS) {
    jobs.delete(id);
    subscribers.delete(id);
    return null;
  }

  return job;
}

/**
 * Subscribe to job updates
 */
export function subscribeToJob(
  id: string,
  callback: (progress: JobProgress) => void,
): () => void {
  let subs = subscribers.get(id);
  if (!subs) {
    subs = new Set();
    subscribers.set(id, subs);
  }
  subs.add(callback);

  // Return unsubscribe function
  return () => {
    subs?.delete(callback);
    if (subs?.size === 0) {
      subscribers.delete(id);
    }
  };
}

/**
 * Clean up completed/expired jobs periodically
 */
export function cleanupJobs(): void {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.updatedAt > JOB_EXPIRY_MS) {
      jobs.delete(id);
      subscribers.delete(id);
    }
  }
}

// Run cleanup every minute
setInterval(cleanupJobs, 60 * 1000);
