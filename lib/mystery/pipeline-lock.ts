/**
 * Atomic file-based pipeline locking to prevent concurrent execution.
 * Uses exclusive file creation (wx flag) for atomic semantics.
 */

import fs from "fs";
import path from "path";
import { projectDir } from "./store";

export interface PipelineLock {
  workerId: string;
  startedAt: string;
  heartbeatAt: string;
}

const LOCK_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Attempt to acquire an exclusive lock for the pipeline.
 * Returns true if lock acquired, false if already held by another worker.
 * @throws if projectDir cannot be created
 */
export function acquirePipelineLock(projectId: string): boolean {
  const lockPath = path.join(projectDir(projectId), ".pipeline.lock");

  const lock: PipelineLock = {
    workerId: generateWorkerId(),
    startedAt: new Date().toISOString(),
    heartbeatAt: new Date().toISOString(),
  };

  try {
    // Try to create lock file atomically (fails if exists)
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2), {
      encoding: "utf-8",
      flag: "wx", // write + exclusive (fails if file exists)
    });
    return true;
  } catch (err: any) {
    if (err.code === "EEXIST") {
      // Lock file already exists - check if stale
      try {
        const existingLock = JSON.parse(fs.readFileSync(lockPath, "utf-8")) as PipelineLock;
        const lockAge = Date.now() - new Date(existingLock.heartbeatAt).getTime();

        // If lock is stale (older than timeout), forcibly take it
        if (lockAge > LOCK_TIMEOUT_MS) {
          console.warn(
            `[pipeline-lock] Stale lock detected (age: ${Math.round(lockAge / 1000)}s), forcibly acquiring`
          );
          fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2), {
            encoding: "utf-8",
            flag: "w", // overwrite
          });
          return true;
        }
      } catch {
        // If we can't read the lock, assume it's invalid and take it
        fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2), {
          encoding: "utf-8",
          flag: "w",
        });
        return true;
      }
      return false;
    }
    throw err;
  }
}

/**
 * Update the heartbeat of an active lock to prevent timeout.
 * Call this periodically during long-running pipeline.
 */
export function updatePipelineHeartbeat(projectId: string): void {
  const lockPath = path.join(projectDir(projectId), ".pipeline.lock");

  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, "utf-8")) as PipelineLock;
    lock.heartbeatAt = new Date().toISOString();
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2), { encoding: "utf-8" });
  } catch {
    // Lock doesn't exist or can't be read - ignore
  }
}

/**
 * Release the pipeline lock.
 * Should always be called when pipeline completes or fails.
 */
export function releasePipelineLock(projectId: string): void {
  const lockPath = path.join(projectDir(projectId), ".pipeline.lock");

  try {
    fs.unlinkSync(lockPath);
  } catch {
    // Lock doesn't exist - ignore
  }
}

/**
 * Check if a pipeline is currently running (lock exists and not stale).
 */
export function isPipelineRunning(projectId: string): boolean {
  const lockPath = path.join(projectDir(projectId), ".pipeline.lock");

  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, "utf-8")) as PipelineLock;
    const lockAge = Date.now() - new Date(lock.heartbeatAt).getTime();

    // If lock is still fresh, pipeline is running
    return lockAge < LOCK_TIMEOUT_MS;
  } catch {
    // Lock doesn't exist or can't be read - pipeline not running
    return false;
  }
}

/**
 * Get elapsed time since pipeline started (in seconds).
 */
export function getPipelineElapsedSeconds(projectId: string): number {
  const lockPath = path.join(projectDir(projectId), ".pipeline.lock");

  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, "utf-8")) as PipelineLock;
    const elapsed = Date.now() - new Date(lock.startedAt).getTime();
    return Math.round(elapsed / 1000);
  } catch {
    return -1;
  }
}

/**
 * Generate a unique worker ID (typically process ID or UUID).
 */
function generateWorkerId(): string {
  if (typeof process !== "undefined" && process.pid) {
    return `worker-${process.pid}-${Date.now()}`;
  }
  return `worker-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`;
}
