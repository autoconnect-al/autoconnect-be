import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class MostWantedDto {
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsNumber() limit?: number;
  @IsOptional() @IsArray() excludeIds?: bigint[];
}
