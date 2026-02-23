import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  Param,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { LegacyJwtAdminGuard } from '../../common/guards/legacy-jwt-admin.guard';
import { LegacyJwtGuard } from '../../common/guards/legacy-jwt.guard';
import { ApCodeGuard } from '../../common/guards/ap-code.guard';
import { ApArticleService } from './ap-article.service';
import { ApPostToolingService } from './ap-post-tooling.service';
import { ApPromptService } from './ap-prompt.service';
import { ApRoleService } from './ap-role.service';
import { ApUserVendorService } from './ap-user-vendor.service';
import { LegacyApService } from './legacy-ap.service';

type AnyRecord = Record<string, unknown>;

@Controller('role-management')
@UseGuards(LegacyJwtAdminGuard)
export class RoleManagementController {
  constructor(private readonly service: ApRoleService) {}

  @Get()
  getRoles() {
    return this.service.getRoles();
  }

  @Post('create-role')
  @HttpCode(200)
  async createRole(@Body() body: unknown) {
    return this.handleLegacy(
      this.service.createRole(this.extractBodyKey(body, 'role')),
    );
  }

  @Post('update-role/:id')
  @HttpCode(200)
  async updateRole(@Param('id') id: string, @Body() body: unknown) {
    return this.handleLegacy(
      this.service.updateRole(id, this.extractBodyKey(body, 'role')),
    );
  }

  @Delete('delete-role/:id')
  @HttpCode(200)
  async deleteRole(@Param('id') id: string) {
    return this.handleLegacy(this.service.deleteRole(id));
  }

  @Post('grant-admin/:id')
  @HttpCode(200)
  async grantAdmin(@Param('id') id: string) {
    return this.handleLegacy(this.service.grantAdminRole(id));
  }

  @Post('revoke-admin/:id')
  @HttpCode(200)
  async revokeAdmin(@Param('id') id: string) {
    return this.handleLegacy(this.service.revokeAdminRole(id));
  }

  @UseGuards(LegacyJwtGuard)
  @Get('role/:id')
  getRole(@Param('id') id: string) {
    return this.service.getRole(id);
  }

  private extractBodyKey(body: unknown, key: string): unknown {
    if (!body || typeof body !== 'object') return body;
    const raw = body as AnyRecord;
    return raw[key] ?? raw;
  }

  private async handleLegacy(
    promise: Promise<{ success: boolean; message: string; statusCode: string }>,
  ) {
    const response = await promise;
    if (!response.success) {
      throw new HttpException(response, Number(response.statusCode) || 500);
    }
    return response;
  }
}

@Controller('user-management')
@UseGuards(LegacyJwtAdminGuard)
export class UserManagementController {
  constructor(private readonly service: ApUserVendorService) {}

  @Get()
  getUsers() {
    return this.service.getUsers();
  }

  @Post('create-user')
  @HttpCode(200)
  async createUser(@Body() body: unknown) {
    return this.handleLegacy(this.service.createUser(body));
  }

  @Post('update-user/:id')
  @HttpCode(200)
  async updateUser(@Param('id') id: string, @Body() body: unknown) {
    return this.handleLegacy(
      this.service.updateUser(id, (body as AnyRecord)?.user ?? body),
    );
  }

  @Delete('delete-user/:id')
  @HttpCode(200)
  async deleteUser(@Param('id') id: string) {
    return this.handleLegacy(this.service.deleteUser(id));
  }

  @UseGuards(LegacyJwtGuard)
  @Get('user/:id')
  getUserById(@Param('id') id: string) {
    return this.service.getUserById(id);
  }

  @UseGuards(LegacyJwtGuard)
  @Get('user/username/:username')
  getUserByUsername(@Param('username') username: string) {
    return this.service.getUserByUsername(username);
  }

  private async handleLegacy(
    promise: Promise<{ success: boolean; message: string; statusCode: string }>,
  ) {
    const response = await promise;
    if (!response.success) {
      throw new HttpException(response, Number(response.statusCode) || 500);
    }
    return response;
  }
}

@Controller('vendor')
@UseGuards(LegacyJwtAdminGuard)
export class VendorAdminController {
  constructor(private readonly service: ApUserVendorService) {}

  @Post('update')
  @HttpCode(200)
  async updateVendor(@Body() body: unknown) {
    const payload = (body as AnyRecord)?.vendor ?? body;
    const id = String((payload as AnyRecord)?.id ?? '');
    return this.handleLegacy(this.service.updateVendorByAdmin(id, payload));
  }

  @Delete('delete/:id')
  @HttpCode(200)
  async deleteVendor(@Param('id') id: string) {
    return this.handleLegacy(this.service.deleteVendorByAdmin(id));
  }

  private async handleLegacy(
    promise: Promise<{ success: boolean; message: string; statusCode: string }>,
  ) {
    const response = await promise;
    if (!response.success) {
      throw new HttpException(response, Number(response.statusCode) || 500);
    }
    return response;
  }
}

@Controller('post')
@UseGuards(ApCodeGuard)
export class PostToolingController {
  constructor(private readonly service: ApPostToolingService) {}

  @Post('save-post')
  @HttpCode(200)
  async savePost(@Body() body: unknown) {
    return this.handleLegacy(this.service.savePost(body));
  }

  @Get('posts')
  async getPosts(@Query('ids') ids?: string) {
    return this.handleLegacy(this.service.getPostsByIds(ids));
  }

  @Post('update/:id')
  @HttpCode(200)
  async updatePost(@Param('id') id: string, @Body() body: unknown) {
    return this.handleLegacy(this.service.updatePostById(id, body));
  }

  @Get('scrape-posts')
  scrapePosts() {
    return this.service.scrapePostsForVendors();
  }

  @Get('scrape-posts/create')
  createScrape(@Query('vendorAccountName') vendorAccountName?: string) {
    return this.handleLegacy(
      this.service.createScrapeStatus(vendorAccountName),
    );
  }

  @Get('scrape-posts/details')
  details() {
    return this.handleLegacy(this.service.getScrapeStatus());
  }

  @Post('scrape-posts/update')
  @HttpCode(200)
  updateScrape(@Body() body: unknown) {
    return this.handleLegacy(this.service.updateScrapeStatus(body));
  }

  @Get('scrape-posts/cleanPosts')
  cleanPosts() {
    return this.handleLegacy(this.service.cleanPosts());
  }

  @Get('scrape-posts/update-search')
  movePostsToSearch() {
    return this.handleLegacy(this.service.movePostsToSearch());
  }

  @Get('scrape-posts/fix-details')
  fixDetails() {
    return this.handleLegacy(this.service.runCommonDetailsFix());
  }

  @Get('get-most-liked')
  getMostLiked() {
    return this.service.getMostLikedPosts();
  }

  @Get('auto-renew')
  autoRenew() {
    return this.handleLegacy(this.service.autoRenewPosts());
  }

  private async handleLegacy(
    promise: Promise<{ success: boolean; message: string; statusCode: string }>,
  ) {
    const response = await promise;
    if (!response.success) {
      throw new HttpException(response, Number(response.statusCode) || 500);
    }
    return response;
  }
}

@Controller('vendor-management')
@UseGuards(LegacyJwtAdminGuard)
export class VendorManagementController {
  constructor(private readonly service: LegacyApService) {}

  @Get('all')
  getAll() {
    return this.service.getVendors();
  }

  @Post('add/:id')
  @HttpCode(200)
  addVendor(@Param('id') id: string) {
    return this.handleLegacy(this.service.addVendor(id));
  }

  @Post('add/details/:id')
  @HttpCode(200)
  addVendorDetails(@Param('id') id: string, @Body() body: unknown) {
    return this.handleLegacy(this.service.addVendorDetails(id, body));
  }

  @Post('edit/:id')
  @HttpCode(200)
  editVendor(@Param('id') id: string, @Body() body: unknown) {
    return this.handleLegacy(
      this.service.editVendor(id, (body as AnyRecord)?.vendor ?? body),
    );
  }

  @Get('next-to-crawl')
  nextToCrawl() {
    return this.service.getNextVendorToCrawl();
  }

  @Get('mark-vendor-for-crawl-next/:id')
  markForCrawl(@Param('id') id: string) {
    return this.handleLegacy(this.service.markVendorForCrawlNext(id));
  }

  @Get('toggle-deleted/:id')
  toggleDeleted(@Param('id') id: string) {
    return this.handleLegacy(this.service.toggleVendorDeleted(id));
  }

  private async handleLegacy(
    promise: Promise<{ success: boolean; message: string; statusCode: string }>,
  ) {
    const response = await promise;
    if (!response.success) {
      throw new HttpException(response, Number(response.statusCode) || 500);
    }
    return response;
  }
}

@Controller('car-details')
@UseGuards(LegacyJwtAdminGuard)
export class CarDetailsAdminController {
  constructor(private readonly service: ApPromptService) {}

  @Get('generate-prompt')
  generatePrompt(@Query('length') length?: string) {
    return this.service.generatePrompt(Number(length ?? 14000), 'general');
  }

  @Get('generate-prompt-fix-variant')
  generateModelPrompt(@Query('length') length?: string) {
    return this.service.generatePrompt(Number(length ?? 4000), 'variant');
  }

  @Get('generate-prompt-fix-registration')
  generateRegistrationPrompt(@Query('length') length?: string) {
    return this.service.generatePrompt(Number(length ?? 9000), 'registration');
  }

  @Get('generate-prompt-fix-mileage')
  generateMileagePrompt(@Query('length') length?: string) {
    return this.service.generatePrompt(Number(length ?? 9000), 'mileage');
  }

  @Get('generate-prompt-fix-price')
  generatePricePrompt(@Query('length') length?: string) {
    return this.service.generatePrompt(Number(length ?? 9000), 'price');
  }

  @Get('generate-prompt-fix-motorcycle-details')
  generateMotorcyclePrompt(@Query('length') length?: string) {
    return this.service.generatePrompt(Number(length ?? 7000), 'motorcycle');
  }

  @Get('get-manual-draft-posts')
  getManualDraftPosts() {
    return this.service.getManualDraftPosts();
  }

  @Post('import')
  @HttpCode(200)
  @UseInterceptors(AnyFilesInterceptor())
  importResult(
    @Req() req: Request,
    @Body() body: Record<string, unknown>,
    @UploadedFiles() _files: Express.Multer.File[],
  ) {
    const text =
      (typeof body.result === 'string' ? body.result : '') ||
      (typeof (req.body as AnyRecord)?.result === 'string'
        ? ((req.body as AnyRecord).result as string)
        : '');
    const runId = typeof body.runId === 'string' ? body.runId : undefined;
    const timeoutMs = this.toOptionalNumber(body.timeoutMs);
    const maxItems = this.toOptionalNumber(body.maxItems);
    return this.handleLegacy(
      this.service.importPromptResults(text, {
        runId,
        timeoutMs: timeoutMs ?? undefined,
        maxItems: maxItems ?? undefined,
      }),
    );
  }

  @Get('import-status/:runId')
  importStatus(@Param('runId') runId: string) {
    return this.handleLegacy(this.service.getPromptImportStatus(runId));
  }

  @Get('clean-cache')
  cleanCache() {
    return this.handleLegacy(this.service.cleanCache());
  }

  private async handleLegacy(
    promise: Promise<{ success: boolean; message: string; statusCode: string }>,
  ) {
    const response = await promise;
    if (!response.success) {
      throw new HttpException(response, Number(response.statusCode) || 500);
    }
    return response;
  }

  private toOptionalNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.trunc(parsed);
  }
}

@Controller('make-model-data')
@UseGuards(LegacyJwtAdminGuard)
export class MakeModelDataController {
  constructor(private readonly service: LegacyApService) {}

  @Get('makes')
  makes() {
    return this.service.makeModelMakes('car');
  }

  @Get('models/:make')
  models(@Param('make') make: string) {
    return this.service.makeModelModels(make, 'car');
  }

  @Get('makes/motorcycle')
  motorcycleMakes() {
    return this.service.makeModelMakes('motorcycle');
  }

  @Get('models/motorcycle/:make')
  motorcycleModels(@Param('make') make: string) {
    return this.service.makeModelModels(make, 'motorcycle');
  }
}

@Controller('article')
@UseGuards(LegacyJwtAdminGuard)
export class ArticleAdminController {
  constructor(private readonly service: ApArticleService) {}

  @Get('all')
  getAll() {
    return this.service.articleAll();
  }

  @Post('create')
  @HttpCode(200)
  create(@Body() body: unknown) {
    return this.service.articleCreate(body);
  }

  @Post('update/:id')
  @HttpCode(200)
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.service.articleUpdate(id, body);
  }

  @Get(':id')
  read(@Param('id') id: string) {
    return this.service.articleRead(id);
  }
}

@Controller('sitemap')
@UseGuards(LegacyJwtAdminGuard)
export class SitemapAdminController {
  constructor(private readonly service: LegacyApService) {}

  @Get('generate')
  generate() {
    return this.service.sitemapGenerate();
  }
}

@Controller('api/v1/orders')
@UseGuards(LegacyJwtAdminGuard)
export class LegacyApPaymentsAdminController {
  constructor(private readonly service: LegacyApService) {}

  @Get('send-remind-emails')
  sendRemindEmails() {
    return this.service.sendRemindEmails();
  }
}
