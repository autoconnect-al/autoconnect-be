import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import type { Job, Queue } from 'bullmq';
import { createLogger } from '../../../common/logger.util';
import { PrismaService } from '../../../database/prisma.service';
import { ApifyDatasetImportService } from '../apify-import/apify-dataset-import.service';
import { EncarScrapeService } from '../encar-import/encar-scrape.service';
import { PostImportService } from '../services/post-import.service';
import {
  IMPORTS_DEAD_LETTER_QUEUE,
  IMPORTS_JOB_APIFY,
  IMPORTS_JOB_ENCAR,
  IMPORTS_JOB_POST_METRIC,
  IMPORTS_QUEUE,
} from './import-jobs.constants';
import type {
  ApifyImportJobData,
  EncarScrapeJobData,
  ImportsDeadLetterPayload,
  PostMetricIncrementJobData,
} from './import-jobs.types';

@Processor(IMPORTS_QUEUE)
export class ImportJobsProcessor extends WorkerHost {
  private readonly logger = createLogger('import-jobs-processor');

  constructor(
    private readonly apifyImportService: ApifyDatasetImportService,
    private readonly encarScrapeService: EncarScrapeService,
    private readonly postImportService: PostImportService,
    private readonly prisma: PrismaService,
    @InjectQueue(IMPORTS_DEAD_LETTER_QUEUE)
    private readonly deadLetterQueue: Queue<ImportsDeadLetterPayload>,
  ) {
    super();
  }

  override async process(job: Job): Promise<void> {
    try {
      switch (job.name) {
        case IMPORTS_JOB_APIFY:
          await this.processApifyImport(job as Job<ApifyImportJobData>);
          return;
        case IMPORTS_JOB_ENCAR:
          await this.processEncarScrape(job as Job<EncarScrapeJobData>);
          return;
        case IMPORTS_JOB_POST_METRIC:
          await this.processPostMetric(job as Job<PostMetricIncrementJobData>);
          return;
        default:
          throw new Error(`Unsupported import queue job: ${job.name}`);
      }
    } catch (error) {
      await this.writeToDeadLetterIfFinalAttempt(job, error);
      throw error;
    }
  }

  private async processApifyImport(job: Job<ApifyImportJobData>) {
    await this.apifyImportService.importLatestDataset(
      job.data.useOpenAI,
      job.data.downloadImages,
      job.data.forceDownloadImages,
      job.data.forceDownloadImagesDays,
    );
  }

  private async processEncarScrape(job: Job<EncarScrapeJobData>) {
    await this.encarScrapeService.scrapeAndSave({
      pages: job.data.pages,
      useOpenAI: job.data.useOpenAI,
      downloadImages: job.data.downloadImages,
      forceDownloadImages: job.data.forceDownloadImages,
      forceDownloadImagesDays: job.data.forceDownloadImagesDays,
    });
  }

  private async processPostMetric(job: Job<PostMetricIncrementJobData>) {
    const postId = BigInt(job.data.postId);

    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });
    if (!post) {
      this.logger.warn('post not found for metric increment', {
        postId: job.data.postId,
        metric: job.data.metric,
      });
      return;
    }

    await this.postImportService.incrementPostMetric(postId, job.data.metric, {
      visitorId: job.data.visitorId,
      contactMethod: job.data.contactMethod,
    });

    this.logger.info('post metric incremented', {
      postId: job.data.postId,
      metric: job.data.metric,
      contactMethod: job.data.contactMethod ?? null,
    });
  }

  private async writeToDeadLetterIfFinalAttempt(job: Job, error: unknown) {
    const maxAttempts = Number(job.opts.attempts ?? 1);
    const currentAttempt = Number(job.attemptsMade) + 1;
    if (currentAttempt < maxAttempts) {
      return;
    }

    const reason = error instanceof Error ? error.message : String(error);
    await this.deadLetterQueue.add(
      `${job.name}-failed`,
      {
        queue: IMPORTS_QUEUE,
        jobName: job.name,
        originalJobId: String(job.id ?? ''),
        attemptsMade: currentAttempt,
        maxAttempts,
        failedAt: new Date().toISOString(),
        reason,
        payload: job.data,
      },
      {
        removeOnComplete: 10000,
        removeOnFail: 10000,
      },
    );
  }
}
