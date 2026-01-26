import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsInt, Min, Max } from 'class-validator';

/**
 * DTO for CSV export query parameters
 */
export class ExportQueryDto {
  @ApiPropertyOptional({
    description: 'Maximum number of rows to export',
    minimum: 1,
    maximum: 100,
    default: 100,
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 100;

  // Allow code parameter for admin authentication (handled by AdminGuard)
  @IsOptional()
  code?: string;
}

/**
 * DTO for published posts CSV export query parameters
 * No limit restriction - can export all records
 */
export class ExportPublishedQueryDto {
  @ApiPropertyOptional({
    description:
      'Maximum number of rows to export (optional - leave empty to export all)',
    minimum: 1,
    example: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  // Allow code parameter for admin authentication (handled by AdminGuard)
  @IsOptional()
  code?: string;
}
