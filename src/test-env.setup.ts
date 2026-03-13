import { resolve } from 'path';
import { config } from 'dotenv';

config({ path: resolve(__dirname, '../.env'), quiet: true });

process.env.POST_METRICS_SIGNING_SECRET =
  process.env.POST_METRICS_SIGNING_SECRET?.trim() ||
  'unit-test-post-metrics-signing-secret';
