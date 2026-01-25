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
}
