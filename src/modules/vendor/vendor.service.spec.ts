import { Test, TestingModule } from '@nestjs/testing';
import { VendorService } from './vendor.service';
import { PrismaService } from '../../database/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('VendorService', () => {
  let service: VendorService;

  const mockPrismaService = {
    vendor: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    post: {
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    car_detail: {
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VendorService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<VendorService>(VendorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new vendor', async () => {
      const createVendorDto = {
        accountName: 'Test Vendor',
        biography: 'Test bio',
      };
      const mockVendor = {
        id: BigInt(1),
        ...createVendorDto,
        dateCreated: new Date(),
        dateUpdated: new Date(),
        deleted: false,
        contact: null,
        profilePicture: null,
        accountExists: true,
        initialised: null,
      };

      mockPrismaService.vendor.create.mockResolvedValue(mockVendor);

      const result = await service.create(createVendorDto);

      expect(result).toEqual(mockVendor);
      expect(mockPrismaService.vendor.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return an array of vendors', async () => {
      const mockVendors = [
        {
          id: BigInt(1),
          accountName: 'Vendor 1',
          deleted: false,
          dateCreated: new Date(),
          dateUpdated: new Date(),
        },
        {
          id: BigInt(2),
          accountName: 'Vendor 2',
          deleted: false,
          dateCreated: new Date(),
          dateUpdated: new Date(),
        },
      ];

      mockPrismaService.vendor.findMany.mockResolvedValue(mockVendors);

      const result = await service.findAll();

      expect(result).toEqual(mockVendors);
      expect(mockPrismaService.vendor.findMany).toHaveBeenCalledWith({
        where: { deleted: false },
        orderBy: { dateCreated: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a vendor by id', async () => {
      const mockVendor = {
        id: BigInt(1),
        accountName: 'Test Vendor',
        deleted: false,
        dateCreated: new Date(),
        dateUpdated: new Date(),
      };

      mockPrismaService.vendor.findUnique.mockResolvedValue(mockVendor);

      const result = await service.findOne(BigInt(1));

      expect(result).toEqual(mockVendor);
    });

    it('should throw NotFoundException if vendor not found', async () => {
      mockPrismaService.vendor.findUnique.mockResolvedValue(null);

      await expect(service.findOne(BigInt(999))).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if vendor is deleted', async () => {
      const mockVendor = {
        id: BigInt(1),
        accountName: 'Test Vendor',
        deleted: true,
        dateCreated: new Date(),
        dateUpdated: new Date(),
      };

      mockPrismaService.vendor.findUnique.mockResolvedValue(mockVendor);

      await expect(service.findOne(BigInt(1))).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a vendor', async () => {
      const mockVendor = {
        id: BigInt(1),
        accountName: 'Test Vendor',
        deleted: false,
        dateCreated: new Date(),
        dateUpdated: new Date(),
        useDetailsForPosts: false,
      };

      const updateDto = { accountName: 'Updated Vendor' };
      const updatedVendor = { ...mockVendor, ...updateDto };

      mockPrismaService.vendor.findUnique.mockResolvedValue(mockVendor);
      mockPrismaService.vendor.update.mockResolvedValue(updatedVendor);

      const result = await service.update(BigInt(1), updateDto);

      expect(result.accountName).toBe('Updated Vendor');
      expect(mockPrismaService.vendor.update).toHaveBeenCalled();
    });

    it('should sync vendor details to car_details when useDetailsForPosts is true', async () => {
      const mockVendor = {
        id: BigInt(1),
        accountName: 'Test Vendor',
        deleted: false,
        dateCreated: new Date(),
        dateUpdated: new Date(),
        useDetailsForPosts: false,
        country: 'Albania',
        city: 'Tirana',
        phoneNumber: '+355123456',
      };

      const updateDto = {
        useDetailsForPosts: true,
        country: 'Albania',
        city: 'Tirana',
      };
      const updatedVendor = { ...mockVendor, ...updateDto };

      const mockPosts = [
        { car_detail_id: BigInt(100) },
        { car_detail_id: BigInt(101) },
      ];

      mockPrismaService.vendor.findUnique.mockResolvedValue(mockVendor);
      mockPrismaService.vendor.update.mockResolvedValue(updatedVendor);
      mockPrismaService.post.findMany.mockResolvedValue(mockPosts);
      mockPrismaService.car_detail.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.update(BigInt(1), updateDto);

      expect(result.useDetailsForPosts).toBe(true);
      expect(mockPrismaService.post.findMany).toHaveBeenCalledWith({
        where: { vendor_id: BigInt(1), deleted: false },
        select: { car_detail_id: true },
      });
      expect(mockPrismaService.car_detail.updateMany).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft delete a vendor and its posts', async () => {
      const mockVendor = {
        id: BigInt(1),
        accountName: 'Test Vendor',
        deleted: false,
        dateCreated: new Date(),
        dateUpdated: new Date(),
      };

      mockPrismaService.vendor.findUnique.mockResolvedValue(mockVendor);

      mockPrismaService.vendor.update.mockResolvedValue({
        ...mockVendor,
        deleted: true,
      });

      mockPrismaService.post.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.remove(BigInt(1));

      expect(result.message).toBe(
        'Vendor and related posts deleted successfully',
      );

      expect(mockPrismaService.vendor.update).toHaveBeenCalledWith({
        where: { id: BigInt(1) },
        data: expect.objectContaining({ deleted: true }),
      });

      expect(mockPrismaService.post.updateMany).toHaveBeenCalledWith({
        where: { vendor_id: BigInt(1) },
        data: expect.objectContaining({ deleted: true }),
      });
    });
  });

  describe('incrementVendorMetric', () => {
    it('should increment vendor_page_impression metric', async () => {
      const vendorId = 123n;
      mockPrismaService.vendor.update.mockResolvedValue({
        id: vendorId,
        vendor_page_impression: 1,
      });

      await service.incrementVendorMetric(vendorId, 'vendor_page_impression');

      expect(mockPrismaService.vendor.update).toHaveBeenCalledWith({
        where: { id: vendorId },
        data: {
          vendor_page_impression: {
            increment: 1,
          },
        },
      });
    });

    it('should throw error for invalid metric', async () => {
      const vendorId = 123n;

      await expect(
        service.incrementVendorMetric(vendorId, 'invalid' as any),
      ).rejects.toThrow('Invalid metric: invalid');
    });
  });
});
