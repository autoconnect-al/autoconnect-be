import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { VendorService } from './vendor.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { AdminGuard } from '../../common/guards/admin.guard';
import * as fs from 'fs';
import * as path from 'path';

// Configure multer storage
const storage = diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const accountPicturesDir = path.join(uploadDir, 'account_pictures');

    // Create directory if it doesn't exist
    if (!fs.existsSync(accountPicturesDir)) {
      fs.mkdirSync(accountPicturesDir, { recursive: true });
    }

    cb(null, accountPicturesDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `vendor-${uniqueSuffix}${extname(file.originalname)}`);
  },
});

@Controller({
  path: 'vendor',
  version: '1',
})
@UseGuards(AdminGuard)
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('profilePicture', {
      storage,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async create(
    @Body() createVendorDto: CreateVendorDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let profilePicturePath: string | undefined;

    if (file) {
      // Store relative path
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      profilePicturePath = path.relative(uploadDir, file.path);
    }

    return this.vendorService.create(createVendorDto, profilePicturePath);
  }

  @Get()
  findAll() {
    return this.vendorService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vendorService.findOne(BigInt(id));
  }

  @Patch(':id')
  @UseInterceptors(
    FileInterceptor('profilePicture', {
      storage,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async update(
    @Param('id') id: string,
    @Body() updateVendorDto: UpdateVendorDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let profilePicturePath: string | undefined;

    if (file) {
      // Store relative path
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      profilePicturePath = path.relative(uploadDir, file.path);
    }

    return this.vendorService.update(
      BigInt(id),
      updateVendorDto,
      profilePicturePath,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vendorService.remove(BigInt(id));
  }

  @Post(':id/sync-instagram')
  syncFromInstagram(@Param('id') id: string) {
    return this.vendorService.syncFromInstagram(BigInt(id));
  }
}
