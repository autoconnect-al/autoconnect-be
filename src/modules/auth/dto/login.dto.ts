import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  identifier: string; // username OR email

  @IsString()
  @MinLength(6)
  password: string;
}
