import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class CreateVendorDto {
  @IsString()
  @IsOptional()
  accountName?: string;

  @IsString()
  @IsOptional()
  biography?: string;

  @IsObject()
  @IsOptional()
  contact?: any;

  @IsBoolean()
  @IsOptional()
  accountExists?: boolean;

  @IsBoolean()
  @IsOptional()
  initialised?: boolean;
}
