import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { LegacyAdminService } from './legacy-admin.service';
import { LegacyJwtAdminGuard } from '../../common/guards/legacy-jwt-admin.guard';
import { LegacyUserId } from '../../common/decorators/legacy-auth.decorators';

@Controller('admin')
@UseGuards(LegacyJwtAdminGuard)
export class LegacyAdminController {
  constructor(private readonly service: LegacyAdminService) {}

  @Get('posts')
  getPosts(@LegacyUserId() userId: string) {
    return this.service.getPosts(userId);
  }

  @Get('posts/:id')
  getPostById(@LegacyUserId() userId: string, @Param('id') id: string) {
    return this.service.getPostById(id, userId);
  }

  @Delete('posts/:id')
  @HttpCode(200)
  deletePost(@LegacyUserId() userId: string, @Param('id') id: string) {
    return this.service.deletePost(id, userId);
  }

  @Patch('posts/:id/sold')
  @HttpCode(200)
  markSold(@LegacyUserId() userId: string, @Param('id') id: string) {
    return this.service.markPostSold(id, userId);
  }

  @Get('user')
  getUser(@LegacyUserId() userId: string) {
    return this.service.getUser(userId);
  }

  @Post('user')
  @HttpCode(200)
  editUser(@LegacyUserId() userId: string, @Body('user') user: unknown) {
    return this.service.editUser(userId, user);
  }

  @Post('user/change-password')
  @HttpCode(200)
  changePassword(@LegacyUserId() userId: string, @Body('user') user: unknown) {
    return this.service.changePassword(userId, user);
  }

  @Post('vendor/contact')
  @HttpCode(200)
  vendorContact(@LegacyUserId() userId: string, @Body('vendor') vendor: unknown) {
    return this.service.updateVendorContact(userId, vendor);
  }

  @Post('vendor/biography')
  @HttpCode(200)
  vendorBiography(
    @LegacyUserId() userId: string,
    @Body('vendor') vendor: unknown,
  ) {
    return this.service.updateVendorBiography(userId, vendor);
  }

  @Post('vendor/profile-picture')
  @HttpCode(200)
  vendorProfilePicture(
    @LegacyUserId() userId: string,
    @Body('vendor') vendor: unknown,
  ) {
    return this.service.updateVendorProfilePicture(userId, vendor);
  }
}
