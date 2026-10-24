import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { JobStatus } from '@prisma/client';

export type JobHandler = (payload: any, orgId: string) => Promise<void>;

class DurableJobQueue {
  private handlers: Map<string, JobHandler> = new Map();
  private isProcessing = false;

  registerHandler(jobType: string, handler: JobHandler) {
    this.handlers.set(jobType, handler);
  }

  /**
   * Enqueues a job into PostgreSQL for durable processing.
   */
  async enqueue(
    orgId: string,
    jobType: string,
    payload: Record<string, unknown>,
    scheduledFor: Date = new Date()
  ): Promise<string> {
    const job = await prisma.durableJob.create({
      data: {
        orgId,
        jobType,
        payload: payload as any,
        scheduledFor,
        status: JobStatus.PENDING,
      },
    });

    logger.debug('Enqueued durable job', { jobId: job.id, jobType, orgId });
    return job.id;
  }

  /**
   * Polls and processes pending jobs with concurrency locking.
   */
  async processNextJobs(batchSize: number = 5): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    try {
      const now = new Date();

      // Acquire jobs ready to run
      const pendingJobs = await prisma.durableJob.findMany({
        where: {
          status: JobStatus.PENDING,
          scheduledFor: { lte: now },
        },
        take: batchSize,
        orderBy: { scheduledFor: 'asc' },
      });

      if (pendingJobs.length === 0) return 0;

      for (const job of pendingJobs) {
        // Mark as PROCESSING
        await prisma.durableJob.update({
          where: { id: job.id },
          data: {
            status: JobStatus.PROCESSING,
            lockedAt: new Date(),
          },
        });

        const handler = this.handlers.get(job.jobType);
        if (!handler) {
          logger.error(`No handler registered for job type: ${job.jobType}`, null, { jobId: job.id });
          await prisma.durableJob.update({
            where: { id: job.id },
            data: {
              status: JobStatus.FAILED,
              lastError: `No handler registered for job type: ${job.jobType}`,
            },
          });
          continue;
        }

        try {
          await handler(job.payload, job.orgId);

          await prisma.durableJob.update({
            where: { id: job.id },
            data: {
              status: JobStatus.COMPLETED,
              completedAt: new Date(),
            },
          });
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          const nextRetry = job.retryCount + 1;
          const isFailed = nextRetry >= job.maxRetries;

          logger.error(`Job processing failed [${job.jobType}]`, err, {
            jobId: job.id,
            retryCount: nextRetry,
          });

          await prisma.durableJob.update({
            where: { id: job.id },
            data: {
              retryCount: nextRetry,
              status: isFailed ? JobStatus.FAILED : JobStatus.PENDING,
              lastError: errorMessage,
              // Exponential backoff: 2s, 4s, 8s
              scheduledFor: new Date(Date.now() + Math.pow(2, nextRetry) * 1000),
            },
          });
        }
      }

      return pendingJobs.length;
    } finally {
      this.isProcessing = false;
    }
  }
}

export const jobQueue = new DurableJobQueue();
