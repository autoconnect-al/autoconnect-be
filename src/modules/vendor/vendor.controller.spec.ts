import { Test, TestingModule } from '@nestjs/testing';
import { VendorController } from './vendor.controller';
import { VendorService } from './vendor.service';
import { PrismaService } from '../../database/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('VendorController', () => {
  let controller: VendorController;
  let vendorService: VendorService;
  let prismaService: PrismaService;

  const mockVendorService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    incrementVendorMetric: jest.fn(),
  };

  const mockPrismaService = {
    vendor: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VendorController],
      providers: [
        {
          provide: VendorService,
          useValue: mockVendorService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<VendorController>(VendorController);
    vendorService = module.get<VendorService>(VendorService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a vendor', async () => {
      const createDto = {
        accountName: 'Test Vendor',
        biography: 'Test bio',
      };
      const mockVendor = {
        id: BigInt(1),
        ...createDto,
        dateCreated: new Date(),
        dateUpdated: new Date(),
        deleted: false,
        contact: null,
        profilePicture: null,
        accountExists: true,
        initialised: null,
      };

      mockVendorService.create.mockResolvedValue(mockVendor);

      const result = await controller.create(createDto);

      expect(result).toEqual(mockVendor);
      expect(mockVendorService.create).toHaveBeenCalledWith(
        createDto,
        undefined,
      );
    });
  });

  describe('findAll', () => {
    it('should return an array of vendors', async () => {
      const mockVendors = [
        {
          id: BigInt(1),
          accountName: 'Vendor 1',
          deleted: false,
        },
        {
          id: BigInt(2),
          accountName: 'Vendor 2',
          deleted: false,
        },
      ];

      mockVendorService.findAll.mockResolvedValue(mockVendors);

      const result = await controller.findAll();

      expect(result).toEqual(mockVendors);
      expect(mockVendorService.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a vendor by id', async () => {
      const mockVendor = {
        id: BigInt(1),
        accountName: 'Test Vendor',
        deleted: false,
      };

      mockVendorService.findOne.mockResolvedValue(mockVendor);

      const result = await controller.findOne('1');

      expect(result).toEqual(mockVendor);
      expect(mockVendorService.findOne).toHaveBeenCalledWith(BigInt(1));
    });
  });

  describe('update', () => {
    it('should update a vendor', async () => {
      const updateDto = { accountName: 'Updated Vendor' };
      const mockVendor = {
        id: BigInt(1),
        accountName: 'Updated Vendor',
        deleted: false,
      };

      mockVendorService.update.mockResolvedValue(mockVendor);

      const result = await controller.update('1', updateDto);

      expect(result).toEqual(mockVendor);
      expect(mockVendorService.update).toHaveBeenCalledWith(
        BigInt(1),
        updateDto,
        undefined,
      );
    });
  });

  describe('remove', () => {
    it('should soft delete a vendor', async () => {
      const mockResult = {
        message: 'Vendor and related posts deleted successfully',
      };

      mockVendorService.remove.mockResolvedValue(mockResult);

      const result = await controller.remove('1');

      expect(result).toEqual(mockResult);
      expect(mockVendorService.remove).toHaveBeenCalledWith(BigInt(1));
    });
  });

  describe('incrementVendorMetric', () => {
    it('should throw BadRequestException for invalid metric', async () => {
      const response = {} as any;
      await expect(
        controller.incrementVendorMetric('123', 'invalid', response),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid vendor ID', async () => {
      const response = {} as any;
      await expect(
        controller.incrementVendorMetric('not-a-number', 'vendor_page_impression', response),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept vendor_page_impression metric', async () => {
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;
      (mockPrismaService.vendor.findUnique as jest.Mock).mockResolvedValue({
        id: 123n,
      });
      (mockVendorService.incrementVendorMetric as jest.Mock).mockResolvedValue(
        undefined,
      );

      await controller.incrementVendorMetric('123', 'vendor_page_impression', mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(202);
    });
  });
});
