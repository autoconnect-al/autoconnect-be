import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreatePostDto {
  @IsObject()
  post!: Record<string, unknown>;
}

export class UpdatePostDto {
  @IsObject()
  post!: Record<string, unknown>;
}

export class CreateUserPostDto {
  @IsObject()
  post!: Record<string, unknown>;
}

export class UploadImageDto {
  @IsOptional()
  @IsString()
  file?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  imageData?: string;

  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  filename?: string;
}
