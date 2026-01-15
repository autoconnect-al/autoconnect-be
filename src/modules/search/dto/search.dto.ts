import {
  IsOptional,
  IsString,
  IsInt,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from './pagination.dto';

export class SearchDto extends PaginationDto {
  // Multi make/model/variant
  @IsOptional() @IsString() make1?: string;
  @IsOptional() @IsString() model1?: string;
  @IsOptional() @IsString() variant1?: string;

  @IsOptional() @IsString() make2?: string;
  @IsOptional() @IsString() model2?: string;
  @IsOptional() @IsString() variant2?: string;

  @IsOptional() @IsString() make3?: string;
  @IsOptional() @IsString() model3?: string;
  @IsOptional() @IsString() variant3?: string;

  // Ranges
  @IsOptional() @Type(() => Number) @IsInt() priceFrom?: number;
  @IsOptional() @Type(() => Number) @IsInt() priceTo?: number;
  @IsOptional() @Type(() => Number) @IsInt() mileageFrom?: number;
  @IsOptional() @Type(() => Number) @IsInt() mileageTo?: number;
  @IsOptional() @Type(() => Number) @IsInt() registrationFrom?: number;
  @IsOptional() @Type(() => Number) @IsInt() registrationTo?: number;

  // Filters
  @IsOptional() @IsString() transmission?: string;
  @IsOptional() @IsString() bodyType?: string;
  @IsOptional() @IsString() fuelType?: string;
  @IsOptional() @IsString() emissionGroup?: string;
  @IsOptional() @IsBoolean() canExchange?: boolean;
  @IsOptional() @IsBoolean() customsPaid?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(75)
  generalSearch?: string;
  @IsOptional()
  @IsString()
  keyword?: string;

  // Sorting
  @IsOptional() @IsString() sortBy?:
    | 'price'
    | 'mileage'
    | 'renewedTime'
    | 'registration';
  @IsOptional() @IsString() sortOrder?: 'asc' | 'desc';
}
