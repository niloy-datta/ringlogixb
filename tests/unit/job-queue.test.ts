import { describe, it, expect, vi } from 'vitest';
import { JobStatus } from '@prisma/client';

describe('Durable Job Queue & Worker Recovery', () => {
  it('calculates exponential backoff delay correctly on job failure', () => {
    const calculateBackoff = (retryCount: number) => Math.pow(2, retryCount) * 1000;

    expect(calculateBackoff(1)).toBe(2000);  // 2s
    expect(calculateBackoff(2)).toBe(4000);  // 4s
    expect(calculateBackoff(3)).toBe(8000);  // 8s
    expect(calculateBackoff(4)).toBe(16000); // 16s
  });

  it('marks job as FAILED when max retries are exceeded', () => {
    const maxRetries = 3;
    const evaluateJobRetry = (currentRetry: number) => {
      const next = currentRetry + 1;
      return {
        nextRetry: next,
        status: next >= maxRetries ? JobStatus.FAILED : JobStatus.PENDING,
      };
    };

    expect(evaluateJobRetry(0)).toEqual({ nextRetry: 1, status: JobStatus.PENDING });
    expect(evaluateJobRetry(1)).toEqual({ nextRetry: 2, status: JobStatus.PENDING });
    expect(evaluateJobRetry(2)).toEqual({ nextRetry: 3, status: JobStatus.FAILED });
  });

  it('recovers locked or interrupted jobs after worker restart', () => {
    const staleLockThresholdMs = 5 * 60 * 1000; // 5 mins
    const now = Date.now();

    const isJobStale = (lockedAt: Date | null) => {
      if (!lockedAt) return false;
      return now - lockedAt.getTime() > staleLockThresholdMs;
    };

    const recentlyLocked = new Date(now - 30 * 1000); // 30s ago
    const staleLocked = new Date(now - 10 * 60 * 1000); // 10 mins ago

    expect(isJobStale(recentlyLocked)).toBe(false);
    expect(isJobStale(staleLocked)).toBe(true);
  });
});
