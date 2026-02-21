import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { JobsOptions, Queue } from 'bullmq';
import { createLogger } from '../../../common/logger.util';
import {
  IMPORTS_JOB_APIFY,
  IMPORTS_JOB_ENCAR,
  IMPORTS_JOB_POST_METRIC,
  IMPORTS_QUEUE,
} from './import-jobs.constants';
import type {
  ApifyImportJobData,
  EncarScrapeJobData,
  PostMetricIncrementJobData,
} from './import-jobs.types';

@Injectable()
export class ImportJobsService {
  private readonly logger = createLogger('import-jobs-service');

  constructor(
    @InjectQueue(IMPORTS_QUEUE)
    private readonly importsQueue: Queue,
  ) {}

  async enqueueApifyImport(payload: ApifyImportJobData) {
    const job = await this.importsQueue.add(IMPORTS_JOB_APIFY, payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    } satisfies JobsOptions);
    this.logger.info('queued apify import job', { jobId: job.id });
    return job;
  }

  async enqueueEncarScrape(payload: EncarScrapeJobData) {
    const job = await this.importsQueue.add(IMPORTS_JOB_ENCAR, payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    } satisfies JobsOptions);
    this.logger.info('queued encar scrape job', { jobId: job.id });
    return job;
  }

  async enqueuePostMetricIncrement(payload: PostMetricIncrementJobData) {
    const job = await this.importsQueue.add(IMPORTS_JOB_POST_METRIC, payload, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 5000,
      removeOnFail: 10000,
    } satisfies JobsOptions);
    return job;
  }
}
