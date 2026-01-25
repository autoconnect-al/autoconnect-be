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
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
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
@ApiTags('Vendor')
@ApiBearerAuth('JWT-auth')
@UseGuards(AdminGuard)
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Create vendor',
    description:
      'Create a new vendor account with optional profile picture upload. Admin only.',
  })
  @ApiCreatedResponse({
    description: 'Vendor created successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid vendor data or file upload error',
  })
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
  @ApiOperation({
    summary: 'Get all vendors',
    description: 'Retrieve a list of all vendors. Admin only.',
  })
  @ApiOkResponse({
    description: 'List of vendors',
  })
  findAll() {
    return this.vendorService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get vendor by ID',
    description: 'Retrieve a specific vendor by their ID. Admin only.',
  })
  @ApiOkResponse({
    description: 'Vendor details',
  })
  @ApiNotFoundResponse({
    description: 'Vendor not found',
  })
  findOne(@Param('id') id: string) {
    return this.vendorService.findOne(BigInt(id));
  }

  @Patch(':id')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update vendor',
    description:
      'Update vendor information with optional profile picture. Admin only.',
  })
  @ApiOkResponse({
    description: 'Vendor updated successfully',
  })
  @ApiNotFoundResponse({
    description: 'Vendor not found',
  })
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
  @ApiOperation({
    summary: 'Delete vendor',
    description: 'Delete a vendor account. Admin only.',
  })
  @ApiOkResponse({
    description: 'Vendor deleted successfully',
  })
  @ApiNotFoundResponse({
    description: 'Vendor not found',
  })
  remove(@Param('id') id: string) {
    return this.vendorService.remove(BigInt(id));
  }

  @Post(':id/sync-instagram')
  @ApiOperation({
    summary: 'Sync Instagram content',
    description:
      'Synchronize vendor Instagram content to their profile. Admin only.',
  })
  @ApiOkResponse({
    description: 'Instagram sync completed',
  })
  @ApiNotFoundResponse({
    description: 'Vendor not found',
  })
  syncFromInstagram(@Param('id') id: string) {
    return this.vendorService.syncFromInstagram(BigInt(id));
  }
}
