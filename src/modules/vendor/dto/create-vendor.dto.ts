import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVendorDto {
  @ApiPropertyOptional({
    description: 'Name of the vendor account',
    example: 'John Doe Auto Sales',
  })
  @IsString()
  @IsOptional()
  accountName?: string;

  @ApiPropertyOptional({
    description: 'Biography or description of the vendor',
    example: 'Professional vehicle seller with 10 years of experience',
  })
  @IsString()
  @IsOptional()
  biography?: string;

  @ApiPropertyOptional({
    description: 'Contact information object',
    example: { phone: '123-456-7890', website: 'https://example.com' },
  })
  @IsObject()
  @IsOptional()
  contact?: any;

  @ApiPropertyOptional({
    description: 'Whether the account already exists on external platform',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  accountExists?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the vendor profile is initialized',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  initialised?: boolean;

  @ApiPropertyOptional({
    description: 'Country code or name',
    example: 'US',
  })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({
    description: 'City location',
    example: 'New York',
  })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({
    description: 'Country of origin for vehicles being sold',
    example: 'US',
  })
  @IsString()
  @IsOptional()
  countryOfOriginForVehicles?: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+1-555-0123',
  })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiPropertyOptional({
    description: 'WhatsApp number',
    example: '+1-555-0123',
  })
  @IsString()
  @IsOptional()
  whatsAppNumber?: string;

  @ApiPropertyOptional({
    description: 'Geographic location details',
    example: 'Manhattan, New York',
  })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({
    description: 'Whether to use vendor details for vehicle posts',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  useDetailsForPosts?: boolean;
}
