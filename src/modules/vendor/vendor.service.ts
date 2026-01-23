import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import * as fs from 'fs/promises';

@Injectable()
export class VendorService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createVendorDto: CreateVendorDto, profilePicture?: string) {
    const vendor = await this.prisma.vendor.create({
      data: {
        id: BigInt(Date.now()), // Generate a unique ID using timestamp
        dateCreated: new Date(),
        dateUpdated: new Date(),
        deleted: false,
        accountName: createVendorDto.accountName,
        biography: createVendorDto.biography,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        contact: createVendorDto.contact,
        accountExists: createVendorDto.accountExists ?? true,
        initialised: createVendorDto.initialised,
        profilePicture: profilePicture,
      },
    });
    return vendor;
  }

  async findAll() {
    const vendors = await this.prisma.vendor.findMany({
      where: {
        deleted: false,
      },
      orderBy: {
        dateCreated: 'desc',
      },
    });
    return vendors;
  }

  async findOne(id: bigint) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
    });

    if (!vendor || vendor.deleted) {
      throw new NotFoundException(`Vendor with ID ${id} not found`);
    }

    return vendor;
  }

  async update(
    id: bigint,
    updateVendorDto: UpdateVendorDto,
    profilePicture?: string,
  ) {
    // Check if vendor exists and is not deleted
    await this.findOne(id);

    const updateData: any = {
      ...updateVendorDto,
      dateUpdated: new Date(),
    };

    if (profilePicture) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      updateData.profilePicture = profilePicture;
    }

    const vendor = await this.prisma.vendor.update({
      where: { id },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: updateData,
    });

    return vendor;
  }

  async remove(id: bigint) {
    // Check if vendor exists and is not deleted
    await this.findOne(id);

    // Soft delete the vendor
    await this.prisma.vendor.update({
      where: { id },
      data: {
        deleted: true,
        dateUpdated: new Date(),
      },
    });

    // Soft delete all related posts
    await this.prisma.post.updateMany({
      where: { vendor_id: id },
      data: {
        deleted: true,
        dateUpdated: new Date(),
      },
    });

    return { message: 'Vendor and related posts deleted successfully' };
  }

  async deleteProfilePicture(filePath: string) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore error if file doesn't exist
      console.error('Error deleting profile picture:', error);
    }
  }
}
