import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';

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
        country: createVendorDto.country,
        city: createVendorDto.city,
        countryOfOriginForVehicles: createVendorDto.countryOfOriginForVehicles,
        phoneNumber: createVendorDto.phoneNumber,
        whatsAppNumber: createVendorDto.whatsAppNumber,
        location: createVendorDto.location,
        useDetailsForPosts: createVendorDto.useDetailsForPosts ?? false,
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

    // If useDetailsForPosts is true, update all car_details associated with this vendor's posts
    if (vendor.useDetailsForPosts) {
      await this.syncVendorDetailsToCarDetails(id, vendor);
    }

    return vendor;
  }

  /**
   * Syncs vendor details to all car_details associated with the vendor's posts
   */
  private async syncVendorDetailsToCarDetails(
    vendorId: bigint,
    vendor: any,
  ): Promise<void> {
    // Get all posts for this vendor
    const posts = await this.prisma.post.findMany({
      where: {
        vendor_id: vendorId,
        deleted: false,
      },
      select: {
        car_detail_id: true,
      },
    });

    // Extract car_detail_ids (filter out null values)
    const carDetailIds = posts
      .map((post) => post.car_detail_id)
      .filter((id): id is bigint => id !== null);

    if (carDetailIds.length === 0) {
      return;
    }

    // Update all car_details with vendor information
    await this.prisma.car_detail.updateMany({
      where: {
        id: {
          in: carDetailIds,
        },
      },
      data: {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        country: vendor.country,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        city: vendor.city,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        countryOfOriginForVehicles: vendor.countryOfOriginForVehicles,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        phoneNumber: vendor.phoneNumber,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        whatsAppNumber: vendor.whatsAppNumber,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        location: vendor.location,
        dateUpdated: new Date(),
      },
    });
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

  /**
   * Syncs vendor profile picture from Instagram public API
   * Fetches the profile picture URL from Instagram and updates the vendor
   */
  async syncFromInstagram(id: bigint): Promise<any> {
    const vendor = await this.findOne(id);

    if (!vendor.accountName) {
      throw new NotFoundException(
        'Vendor does not have an Instagram account name',
      );
    }

    try {
      // Fetch Instagram profile data from public API
      const response = await fetch(
        `https://www.instagram.com/${vendor.accountName}/?__a=1&__d=dis`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Accept: 'application/json',
          },
        },
      );

      if (!response.ok) {
        throw new Error('Failed to fetch Instagram profile');
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = await response.json();

      // Extract profile picture URL
      // Note: Instagram's API structure may vary, this is a common pattern
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const profilePicUrl = data?.graphql?.user?.profile_pic_url_hd;

      if (!profilePicUrl) {
        return {
          success: false,
          message: 'Could not extract profile picture from Instagram',
        };
      }

      // Update vendor with new profile picture URL
      const updatedVendor = await this.prisma.vendor.update({
        where: { id },
        data: {
          profilePicture: profilePicUrl as string,
          dateUpdated: new Date(),
        },
      });

      return {
        success: true,
        message: 'Profile picture synced from Instagram successfully',
        vendor: updatedVendor,
      };
    } catch (error) {
      console.error('Error syncing from Instagram:', error);
      return {
        success: false,
        message: `Failed to sync from Instagram: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
