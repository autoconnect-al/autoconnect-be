import {
  Controller,
  Post,
  Param,
  Query,
  HttpStatus,
  Res,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { PostImportService } from './services/post-import.service';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../../database/prisma.service';

@Controller({
  path: 'posts',
  version: '1',
})
export class PostController {
  constructor(
    private readonly postImportService: PostImportService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Increment a post metric (postOpen or impressions)
   * Returns immediately and processes the increment asynchronously
   * High rate limit: 1000 requests per 60 seconds per IP
   */
  @Post(':postId/increment')
  @Throttle({ default: { limit: 1000, ttl: 60 } })
  @ApiOperation({
    summary: 'Increment post metric',
    description:
      'Increments a post metric (postOpen or impressions). Returns immediately and processes asynchronously.',
  })
  @ApiParam({
    name: 'postId',
    type: 'string',
    description: 'The ID of the post to increment',
  })
  @ApiQuery({
    name: 'metric',
    type: 'string',
    enum: ['postOpen', 'impressions'],
    description: 'The metric to increment',
    required: true,
  })
  @ApiResponse({
    status: 202,
    description: 'Increment queued successfully',
    schema: {
      example: { ok: true, status: 'queued' },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid metric or post ID',
    schema: {
      example: { statusCode: 400, message: 'Invalid metric' },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Post not found',
    schema: {
      example: { statusCode: 404, message: 'Post not found' },
    },
  })
  async incrementPostMetric(
    @Param('postId') postId: string,
    @Query('metric') metric: string,
    @Res() res: Response,
  ) {
    // Validate metric
    if (!['postOpen', 'impressions'].includes(metric)) {
      throw new BadRequestException(
        `Invalid metric: ${metric}. Must be 'postOpen' or 'impressions'.`,
      );
    }

    // Parse postId as BigInt
    let parsedPostId: bigint;
    try {
      parsedPostId = BigInt(postId);
    } catch (error) {
      throw new BadRequestException('Invalid post ID format');
    }

    // Return immediately with 202 Accepted
    res.status(HttpStatus.ACCEPTED).json({ ok: true, status: 'queued' });

    // Process increment asynchronously
    setImmediate(async () => {
      try {
        // Verify post exists
        const post = await this.prisma.post.findUnique({
          where: { id: parsedPostId },
          select: { id: true },
        });

        if (!post) {
          console.warn(`[PostMetric] Post ${postId} not found`);
          return;
        }

        // Increment the metric
        await this.postImportService.incrementPostMetric(
          parsedPostId,
          metric as 'postOpen' | 'impressions',
        );

        console.log(
          `[PostMetric] Successfully incremented ${metric} for post ${postId}`,
        );
      } catch (error) {
        console.error(
          `[PostMetric] Failed to increment ${metric} for post ${postId}:`,
          error,
        );
      }
    });
  }
}
