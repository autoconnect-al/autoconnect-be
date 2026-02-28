import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Body,
  HttpCode,
  HttpException,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { LegacyDataService } from './legacy-data.service';
import { LocalPostOrderService } from '../legacy-group-b/local-post-order.service';
import { LocalMediaService } from './local-media.service';
import { LegacyJwtEmail } from '../../common/decorators/legacy-auth.decorators';
import {
  CreatePostDto,
  CreateUserPostDto,
  UpdatePostDto,
  UploadImageDto,
} from './dto/data-mutations.dto';

@Controller('data')
export class LegacyDataController {
  constructor(
    private readonly service: LegacyDataService,
    private readonly localPostOrderService: LocalPostOrderService,
    private readonly localMediaService: LocalMediaService,
  ) {}

  private throwLegacy(
    message: string,
    statusCode: string,
    httpStatus?: number,
  ) {
    throw new HttpException(
      {
        success: false,
        message,
        statusCode,
      },
      httpStatus ?? (Number(statusCode) || 500),
    );
  }

  @Get('makes')
  getMakes() {
    return this.service.makes('car');
  }

  @Get('models/:make')
  getModels(@Param('make') make: string, @Query('full') full?: string) {
    return this.service.models(make, 'car', full === 'true');
  }

  @Get('makes/motorcycles')
  getMotorcycleMakes() {
    return this.service.makes('motorcycle');
  }

  @Get('models/motorcycles/:make')
  getMotorcycleModels(
    @Param('make') make: string,
    @Query('full') full?: string,
  ) {
    return this.service.models(make, 'motorcycle', full === 'true');
  }

  @Get('vendors/:name')
  getVendor(@Param('name') name: string) {
    return this.service.vendor(name);
  }

  @Get('vendors/biography/:name')
  getVendorBiography(@Param('name') name: string) {
    return this.service.vendorBiography(name);
  }

  @Get('article/:lang/:id')
  getArticle(
    @Param('lang') lang: string,
    @Param('id') id: string,
    @Query('app') app?: string,
  ) {
    return this.service.article(lang, id, app);
  }

  @Get('articles/:lang/:id')
  getArticles(
    @Param('lang') lang: string,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('app') app?: string,
  ) {
    const pageValue = page ? Math.max(Number(page) - 1, 0) : 0;
    return this.service.articles(
      lang,
      id,
      Number.isNaN(pageValue) ? 0 : pageValue,
      app,
    );
  }

  @Get('articles/:lang/:id/total')
  getTotal(
    @Param('lang') lang: string,
    @Param('id') id: string,
    @Query('app') app?: string,
  ) {
    return this.service.articlesTotal(lang, id, app);
  }

  @Get('latest/articles/:lang')
  getLatest(@Param('lang') lang: string, @Query('app') app?: string) {
    return this.service.latestArticles(lang, app);
  }

  @Get('related/articles/:lang/:category')
  getRelated(
    @Param('lang') lang: string,
    @Param('category') category: string,
    @Query('app') app?: string,
    @Query('excludeId') excludeId?: string,
  ) {
    return this.service.relatedArticles(lang, category, app, excludeId);
  }

  @Get('metadata/articles/:lang/:id')
  getMetadata(
    @Param('lang') lang: string,
    @Param('id') id: string,
    @Query('app') app?: string,
  ) {
    return this.service.metadata(lang, id, app);
  }

  @Post('create-post')
  @HttpCode(200)
  async createPost(
    @Body() body: CreatePostDto,
    @LegacyJwtEmail() jwtEmail?: string,
  ) {
    const response = await this.localPostOrderService.createPost(
      body,
      jwtEmail,
    );
    if (!response.success)
      this.throwLegacy('ERROR: Something went wrong', '500', 500);
    return response;
  }

  @Post('update-post')
  @HttpCode(200)
  async updatePost(
    @Body() body: UpdatePostDto,
    @LegacyJwtEmail() jwtEmail?: string,
  ) {
    const response = await this.localPostOrderService.updatePost(
      body,
      jwtEmail,
    );
    if (!response.success)
      this.throwLegacy('ERROR: Something went wrong', '500', 500);
    return response;
  }

  @Post('create-user-post')
  @HttpCode(200)
  async createUserPost(
    @Body() body: CreateUserPostDto,
    @LegacyJwtEmail() jwtEmail?: string,
  ) {
    const response = await this.localPostOrderService.createUserAndPost(
      body,
      jwtEmail,
    );
    if (!response.success)
      this.throwLegacy('ERROR: Something went wrong', '500', 500);
    return response;
  }

  @Post('upload-image')
  @HttpCode(200)
  @UseInterceptors(AnyFilesInterceptor())
  uploadImage(
    @Body() body: UploadImageDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.localMediaService.uploadImage(body, files);
  }
}
