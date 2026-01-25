import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MostWantedDto {
  @ApiPropertyOptional({
    description: 'Type of most wanted vehicles',
    example: 'trending',
  })
  @IsOptional()
  @IsString()
  type?: string;
  @ApiPropertyOptional({
    description: 'Maximum number of results to return',
    example: 10,
  })
  @IsOptional()
  @IsNumber()
  limit?: number;
  @ApiPropertyOptional({
    description: 'Array of vehicle IDs to exclude from results',
    example: [],
  })
  @IsOptional()
  @IsArray()
  excludeIds?: bigint[];
}
