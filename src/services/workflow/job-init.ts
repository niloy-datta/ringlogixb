import { jobQueue } from './job-queue';
import { correlationService } from '../receiving/correlation-service';
import { exceptionService } from '../receiving/exception-service';
import { logger } from '@/lib/logger';

let isInitialized = false;

export function initializeJobQueue() {
  if (isInitialized) return;
  isInitialized = true;

  logger.info('Initializing DockFlow background job queue handlers');

  // Register CORRELATE_EVENT handler
  jobQueue.registerHandler('CORRELATE_EVENT', async (payload: any, orgId: string) => {
    await correlationService.processEventCorrelation(payload, orgId);
  });

  // Register DETECT_EXCEPTIONS handler
  jobQueue.registerHandler('DETECT_EXCEPTIONS', async (_payload: any, orgId: string) => {
    await exceptionService.scanForExceptions(orgId);
  });
}

// Auto-initialize on import
initializeJobQueue();
