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

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  countryOfOriginForVehicles?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  whatsAppNumber?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsBoolean()
  @IsOptional()
  useDetailsForPosts?: boolean;
}
