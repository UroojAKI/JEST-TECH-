import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { JobType } from '@prisma/client';

import { NotificationWorker } from './workers/notification.worker';
import { RenewalWorker } from './workers/renewal.worker';
import { WorkflowWorker } from './workers/workflow.worker';
import { ReportWorker } from './workers/report.worker';
import { AuditWorker } from './workers/audit.worker';

@Processor('system-queue')
export class SystemQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(SystemQueueProcessor.name);

  constructor(
    private readonly notificationWorker: NotificationWorker,
    private readonly renewalWorker: RenewalWorker,
    private readonly workflowWorker: WorkflowWorker,
    private readonly reportWorker: ReportWorker,
    private readonly auditWorker: AuditWorker,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing job type: ${job.name} with id: ${job.id}`);

    switch (job.name) {
      case JobType.NOTIFICATION:
      case JobType.EMAIL:
      case JobType.SMS:
      case JobType.WHATSAPP:
        await this.notificationWorker.process(job);
        break;
      case JobType.RENEWAL:
        await this.renewalWorker.process(job);
        break;
      case JobType.WORKFLOW:
        await this.workflowWorker.process(job);
        break;
      case JobType.REPORT:
        await this.reportWorker.process(job);
        break;
      case JobType.AUDIT:
        await this.auditWorker.process(job);
        break;
      default:
        this.logger.warn(
          `No specific worker defined for job type: ${job.name}`,
        );
        // Fallback or generic processing
        await new Promise((resolve) => setTimeout(resolve, 500));
        break;
    }

    this.logger.log(
      `Successfully completed job [${job.name}] with id: ${job.id}`,
    );
  }
}
