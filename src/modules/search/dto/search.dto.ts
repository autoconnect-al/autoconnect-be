import {
  IsOptional,
  IsString,
  IsInt,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from './pagination.dto';

export class SearchDto extends PaginationDto {
  // Multi make/model/variant
  @ApiPropertyOptional({
    description: 'Vehicle make/brand (first option)',
    example: 'Toyota',
  })
  @IsOptional()
  @IsString()
  make1?: string;
  @ApiPropertyOptional({
    description: 'Vehicle model (first option)',
    example: 'Camry',
  })
  @IsOptional()
  @IsString()
  model1?: string;
  @ApiPropertyOptional({
    description: 'Vehicle variant (first option)',
    example: 'LE',
  })
  @IsOptional()
  @IsString()
  variant1?: string;

  @ApiPropertyOptional({
    description: 'Vehicle make/brand (second option)',
    example: 'Honda',
  })
  @IsOptional()
  @IsString()
  make2?: string;
  @ApiPropertyOptional({
    description: 'Vehicle model (second option)',
    example: 'Accord',
  })
  @IsOptional()
  @IsString()
  model2?: string;
  @ApiPropertyOptional({
    description: 'Vehicle variant (second option)',
    example: 'EX',
  })
  @IsOptional()
  @IsString()
  variant2?: string;

  @ApiPropertyOptional({
    description: 'Vehicle make/brand (third option)',
    example: 'BMW',
  })
  @IsOptional()
  @IsString()
  make3?: string;
  @ApiPropertyOptional({
    description: 'Vehicle model (third option)',
    example: '3 Series',
  })
  @IsOptional()
  @IsString()
  model3?: string;
  @ApiPropertyOptional({
    description: 'Vehicle variant (third option)',
    example: '320i',
  })
  @IsOptional()
  @IsString()
  variant3?: string;

  // Ranges
  @ApiPropertyOptional({
    description: 'Minimum price filter',
    example: 10000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priceFrom?: number;
  @ApiPropertyOptional({
    description: 'Maximum price filter',
    example: 50000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priceTo?: number;
  @ApiPropertyOptional({
    description: 'Minimum mileage filter',
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  mileageFrom?: number;
  @ApiPropertyOptional({
    description: 'Maximum mileage filter',
    example: 100000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  mileageTo?: number;
  @ApiPropertyOptional({
    description: 'Minimum registration year',
    example: 2015,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  registrationFrom?: number;
  @ApiPropertyOptional({
    description: 'Maximum registration year',
    example: 2024,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  registrationTo?: number;

  // Filters
  @ApiPropertyOptional({
    description: 'Transmission type filter',
    example: 'automatic',
    enum: ['automatic', 'manual'],
  })
  @IsOptional()
  @IsString()
  transmission?: string;
  @ApiPropertyOptional({
    description: 'Body type filter',
    example: 'sedan',
    enum: ['sedan', 'suv', 'truck', 'coupe', 'hatchback'],
  })
  @IsOptional()
  @IsString()
  bodyType?: string;
  @ApiPropertyOptional({
    description: 'Fuel type filter',
    example: 'gasoline',
    enum: ['gasoline', 'diesel', 'hybrid', 'electric'],
  })
  @IsOptional()
  @IsString()
  fuelType?: string;
  @ApiPropertyOptional({
    description: 'Emission group filter',
    example: 'euro5',
  })
  @IsOptional()
  @IsString()
  emissionGroup?: string;
  @ApiPropertyOptional({
    description: 'Filter vehicles available for exchange',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  canExchange?: boolean;
  @ApiPropertyOptional({
    description: 'Filter vehicles with customs paid',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  customsPaid?: boolean;

  @ApiPropertyOptional({
    description: 'General search term across all fields',
    example: 'red sedan under $30k',
    maxLength: 75,
  })
  @IsOptional()
  @IsString()
  @MaxLength(75)
  generalSearch?: string;
  @ApiPropertyOptional({
    description: 'Specific keyword search',
    example: 'automatic transmission',
  })
  @IsOptional()
  @IsString()
  keyword?: string;

  // Sorting
  @ApiPropertyOptional({
    description: 'Field to sort by',
    example: 'price',
    enum: ['price', 'mileage', 'renewedTime', 'registration'],
  })
  @IsOptional()
  @IsString()
  sortBy?: 'price' | 'mileage' | 'renewedTime' | 'registration';
  @ApiPropertyOptional({
    description: 'Sort order direction',
    example: 'asc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}
