import {
  Controller,
  Post,
  Get,
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
  path: ['posts', 'api/v1/posts'],
})
export class PostController {
  constructor(
    private readonly postImportService: PostImportService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Increment a post metric (postOpen, impressions, reach, clicks, or contact)
   * Returns immediately and processes the increment asynchronously
   * High rate limit: 1000 requests per 60 seconds per IP
   */
  @Post(':postId/increment')
  @Get(':postId/increment')
  @Throttle({ default: { limit: 1000, ttl: 60 } })
  @ApiOperation({
    summary: 'Increment post metric',
    description:
      'Increments a post metric (postOpen, impressions, reach, clicks, or contact). Returns immediately and processes asynchronously.',
  })
  @ApiParam({
    name: 'postId',
    type: 'string',
    description: 'The ID of the post to increment',
  })
  @ApiQuery({
    name: 'metric',
    type: 'string',
    enum: ['postOpen', 'impressions', 'reach', 'clicks', 'contact'],
    description: 'The metric to increment',
    required: true,
  })
  @ApiQuery({
    name: 'visitorId',
    type: 'string',
    description:
      'Anonymous visitor ID for unique reach deduplication (used with metric=impressions)',
    required: false,
  })
  @ApiQuery({
    name: 'contactMethod',
    type: 'string',
    enum: ['call', 'whatsapp', 'email', 'instagram'],
    description:
      'Contact method breakdown (required when metric=contact, ignored otherwise)',
    required: false,
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
    @Query('visitorId') visitorId?: string,
    @Query('contactMethod') contactMethod?: string,
  ) {
    const allowedMetrics = [
      'postOpen',
      'impressions',
      'reach',
      'clicks',
      'contact',
    ] as const;
    const allowedContactMethods = ['call', 'whatsapp', 'email', 'instagram'];

    // Validate metric
    if (!allowedMetrics.includes(metric as (typeof allowedMetrics)[number])) {
      throw new BadRequestException(
        `Invalid metric: ${metric}. Must be 'postOpen', 'impressions', 'reach', 'clicks', or 'contact'.`,
      );
    }

    if (metric === 'contact') {
      if (
        !contactMethod ||
        !allowedContactMethods.includes(contactMethod.toLowerCase())
      ) {
        throw new BadRequestException(
          "Invalid contact method. Must be one of 'call', 'whatsapp', 'email', 'instagram' when metric=contact.",
        );
      }
    }

    const sanitizedVisitorId =
      typeof visitorId === 'string' && visitorId.trim().length > 0
        ? visitorId.trim().slice(0, 255)
        : undefined;
    const normalizedContactMethod =
      typeof contactMethod === 'string' && contactMethod.trim().length > 0
        ? contactMethod.trim().toLowerCase()
        : undefined;

    // Parse postId as BigInt
    let parsedPostId: bigint;
    try {
      parsedPostId = BigInt(postId);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      throw new BadRequestException('Invalid post ID format');
    }

    // Return immediately with 202 Accepted
    res.status(HttpStatus.ACCEPTED).json({ ok: true, status: 'queued' });

    // Process increment asynchronously
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
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
          metric as 'postOpen' | 'impressions' | 'reach' | 'clicks' | 'contact',
          {
            visitorId: sanitizedVisitorId,
            contactMethod: normalizedContactMethod as
              | 'call'
              | 'whatsapp'
              | 'email'
              | 'instagram'
              | undefined,
          },
        );

        console.log(
          `[PostMetric] Successfully incremented ${metric} for post ${postId}${normalizedContactMethod ? ` [${normalizedContactMethod}]` : ''}`,
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
