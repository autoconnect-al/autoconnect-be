import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Username or email address',
    example: 'john.doe@example.com',
  })
  @IsString()
  identifier: string; // username OR email

  @ApiProperty({
    description: 'User password (minimum 6 characters)',
    example: 'SecurePassword123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;
}
