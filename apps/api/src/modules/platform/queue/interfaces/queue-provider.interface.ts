import { JobType } from '@prisma/client';

export interface EnqueueOptions {
  attempts?: number;
  delay?: number;
  backoff?: { type: 'fixed' | 'exponential'; delay: number };
  priority?: number;
  timeout?: number;
  correlationId?: string;
  createdBy?: string;
}

export const QUEUE_PROVIDER_TOKEN = 'QUEUE_PROVIDER_TOKEN';

export interface QueueProvider {
  /**
   * Enqueue a job for background processing
   */
  enqueue(type: JobType, payload: any, options?: EnqueueOptions): Promise<string>;
  
  /**
   * Schedule a job to run at a specific date
   */
  schedule(type: JobType, payload: any, date: Date, options?: EnqueueOptions): Promise<string>;
  
  /**
   * Cancel an active or queued job
   */
  cancel(jobId: string): Promise<boolean>;
  
  /**
   * Manually retry a failed job
   */
  retry(jobId: string): Promise<boolean>;
  
  /**
   * Remove a job completely from the system
   */
  remove(jobId: string): Promise<boolean>;
}
