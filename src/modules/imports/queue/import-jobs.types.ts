export type ApifyImportJobData = {
  useOpenAI: boolean;
  downloadImages: boolean;
  forceDownloadImages: boolean;
  forceDownloadImagesDays?: number;
};

export type EncarScrapeJobData = {
  pages: number;
  useOpenAI: boolean;
  downloadImages: boolean;
  forceDownloadImages: boolean;
  forceDownloadImagesDays?: number;
};

export type PostMetricIncrementJobData = {
  postId: string;
  metric: 'postOpen' | 'impressions' | 'reach' | 'clicks' | 'contact';
  visitorId?: string;
  contactMethod?: 'call' | 'whatsapp' | 'email' | 'instagram';
};

export type ImportsDeadLetterPayload = {
  queue: string;
  jobName: string;
  originalJobId: string;
  attemptsMade: number;
  maxAttempts: number;
  failedAt: string;
  reason: string;
  payload: unknown;
};
