import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { LegacyAdminService } from './legacy-admin.service';
import {
  verifyAndDecodeLegacyJwtPayload,
  extractLegacyBearerToken,
} from '../../common/legacy-auth.util';
import type { Request } from 'express';

@Controller('admin')
export class LegacyAdminController {
  constructor(private readonly service: LegacyAdminService) {}

  private unauthorized(): never {
    throw new HttpException(
      {
        success: false,
        message: 'ERROR: Not authorised',
        statusCode: '401',
      },
      401,
    );
  }

  private getToken(req: Request): string | null {
    try {
      return extractLegacyBearerToken(req.headers as Record<string, unknown>);
    } catch {
      return null;
    }
  }

  private getUserIdFromToken(token: string): string | null {
    const payload = verifyAndDecodeLegacyJwtPayload(token);
    const userId = payload?.userId;
    if (typeof userId === 'string' && userId.length > 0) return userId;
    if (typeof userId === 'number') return String(userId);
    return null;
  }

  private requireUserId(req: Request): string {
    const token = this.getToken(req);
    if (!token) this.unauthorized();
    const userId = this.getUserIdFromToken(token);
    if (!userId) this.unauthorized();
    return userId;
  }

  @Get('posts')
  getPosts(@Req() req: Request) {
    const userId = this.requireUserId(req);
    return this.service.getPosts(userId);
  }

  @Get('posts/:id')
  getPostById(@Req() req: Request, @Param('id') id: string) {
    const userId = this.requireUserId(req);
    return this.service.getPostById(id, userId);
  }

  @Get('posts/delete/:id')
  deletePost(@Req() req: Request, @Param('id') id: string) {
    const userId = this.requireUserId(req);
    return this.service.deletePost(id, userId);
  }

  @Get('posts/sold/:id')
  markSold(@Req() req: Request, @Param('id') id: string) {
    const userId = this.requireUserId(req);
    return this.service.markPostSold(id, userId);
  }

  @Get('user')
  getUser(@Req() req: Request) {
    const userId = this.requireUserId(req);
    return this.service.getUser(userId);
  }

  @Post('user')
  @HttpCode(200)
  editUser(@Req() req: Request, @Body('user') user: unknown) {
    const userId = this.requireUserId(req);
    return this.service.editUser(userId, user);
  }

  @Post('user/change-password')
  @HttpCode(200)
  changePassword(@Req() req: Request, @Body('user') user: unknown) {
    const userId = this.requireUserId(req);
    return this.service.changePassword(userId, user);
  }

  @Post('vendor/contact')
  @HttpCode(200)
  vendorContact(@Req() req: Request, @Body('vendor') vendor: unknown) {
    const userId = this.requireUserId(req);
    return this.service.updateVendorContact(userId, vendor);
  }

  @Post('vendor/biography')
  @HttpCode(200)
  vendorBiography(@Req() req: Request, @Body('vendor') vendor: unknown) {
    const userId = this.requireUserId(req);
    return this.service.updateVendorBiography(userId, vendor);
  }

  @Post('vendor/profile-picture')
  @HttpCode(200)
  vendorProfilePicture(@Req() req: Request, @Body('vendor') vendor: unknown) {
    const userId = this.requireUserId(req);
    return this.service.updateVendorProfilePicture(userId, vendor);
  }
}
