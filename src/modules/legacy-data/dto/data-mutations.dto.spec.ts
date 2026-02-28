import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreatePostDto,
  CreateUserPostDto,
  UpdatePostDto,
  UploadImageDto,
} from './data-mutations.dto';

describe('data mutation DTO validation', () => {
  it('rejects create/update/create-user-post payloads without post object', async () => {
    const createErrors = await validate(plainToInstance(CreatePostDto, {}));
    const updateErrors = await validate(plainToInstance(UpdatePostDto, {}));
    const createUserErrors = await validate(
      plainToInstance(CreateUserPostDto, {}),
    );

    expect(createErrors.length).toBeGreaterThan(0);
    expect(updateErrors.length).toBeGreaterThan(0);
    expect(createUserErrors.length).toBeGreaterThan(0);
  });

  it('accepts valid post payload object for mutation DTOs', async () => {
    const payload = { post: { caption: 'test', cardDetails: { make: 'BMW' } } };
    const createErrors = await validate(plainToInstance(CreatePostDto, payload));
    const updateErrors = await validate(plainToInstance(UpdatePostDto, payload));
    const createUserErrors = await validate(
      plainToInstance(CreateUserPostDto, payload),
    );

    expect(createErrors).toEqual([]);
    expect(updateErrors).toEqual([]);
    expect(createUserErrors).toEqual([]);
  });

  it('accepts legacy-compatible optional upload-image keys', async () => {
    const payload = {
      id: 'abc123',
      filename: 'sample.jpg',
      imageData: '{"file":"data:image/png;base64,AAAA"}',
    };
    const errors = await validate(plainToInstance(UploadImageDto, payload));

    expect(errors).toEqual([]);
  });
});
