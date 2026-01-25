import { Test, TestingModule } from '@nestjs/testing';
import { BulkImportService } from './bulk-import.service';
import { PrismaService } from '../../database/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('BulkImportService', () => {
  let service: BulkImportService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    $queryRawUnsafe: jest.fn(),
    post: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    car_detail: {
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BulkImportService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<BulkImportService>(BulkImportService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fetchPostsForExport', () => {
    it('should fetch posts with default limit of 100', async () => {
      const mockResults = [
        {
          id: BigInt(1),
          origin: 'instagram',
          revalidate: false,
          dateCreated: new Date(),
          car_detail_id: null,
          caption: 'Test caption',
          cleanedCaption: 'Test cleaned caption',
          vendor_id: BigInt(1),
          status: 'active',
          cd_id: null,
          cd_published: null,
          cd_sold: null,
          cd_deleted: null,
          cd_make: null,
          cd_model: null,
          cd_variant: null,
          cd_registration: null,
          cd_mileage: null,
          cd_transmission: null,
          cd_fuelType: null,
          cd_engineSize: null,
          cd_drivetrain: null,
          cd_seats: null,
          cd_numberOfDoors: null,
          cd_bodyType: null,
          cd_customsPaid: null,
          cd_options: null,
          cd_price: null,
          cd_emissionGroup: null,
          cd_type: null,
          cd_contact: null,
          cd_priceVerified: null,
          cd_mileageVerified: null,
          cd_country: null,
          cd_city: null,
          cd_countryOfOriginForVehicles: null,
          cd_phoneNumber: null,
          cd_whatsAppNumber: null,
          cd_location: null,
          grp1_pub_or_revalidate: 1,
          grp2_not_sold: 1,
          grp3_not_deleted: 1,
          grp4_origin_ok: 1,
          matches_query: 1,
          car_detail_missing: 1,
        },
      ];

      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockResults);

      const results = await service.fetchPostsForExport();

      expect(results).toEqual(mockResults);
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ?'),
        100,
      );
    });

    it('should fetch posts with custom limit', async () => {
      const mockResults = [];
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockResults);

      await service.fetchPostsForExport(50);

      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ?'),
        50,
      );
    });
  });

  describe('generateCSV', () => {
    it('should generate CSV from query results', async () => {
      const mockResults = [
        {
          id: BigInt(1),
          origin: 'instagram',
          revalidate: false,
          dateCreated: new Date('2026-01-01'),
          car_detail_id: null,
          caption: 'Test caption',
          cleanedCaption: 'Test cleaned caption',
          vendor_id: BigInt(1),
          status: 'active',
          cd_id: null,
          cd_published: null,
          cd_sold: null,
          cd_deleted: null,
          cd_make: 'Toyota',
          cd_model: 'Camry',
          cd_variant: null,
          cd_registration: '2020',
          cd_mileage: 50000,
          cd_transmission: 'Automatic',
          cd_fuelType: 'Petrol',
          cd_engineSize: '2.5L',
          cd_drivetrain: 'FWD',
          cd_seats: 5,
          cd_numberOfDoors: 4,
          cd_bodyType: 'Sedan',
          cd_customsPaid: true,
          cd_options: 'Leather seats',
          cd_price: 25000,
          cd_emissionGroup: 'Euro 6',
          cd_type: 'car',
          cd_contact: null,
          cd_priceVerified: false,
          cd_mileageVerified: false,
          cd_country: 'Georgia',
          cd_city: 'Tbilisi',
          cd_countryOfOriginForVehicles: 'Japan',
          cd_phoneNumber: '+995555555555',
          cd_whatsAppNumber: '+995555555555',
          cd_location: 'Downtown',
          grp1_pub_or_revalidate: 1,
          grp2_not_sold: 1,
          grp3_not_deleted: 1,
          grp4_origin_ok: 1,
          matches_query: 1,
          car_detail_missing: 1,
        },
      ];

      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockResults);

      const csv = await service.generateCSV(100);

      expect(csv).toBeDefined();
      expect(typeof csv).toBe('string');
      expect(csv).toContain('post_id');
      expect(csv).toContain('cd_make');
      expect(csv).toContain('Toyota');
    });
  });

  describe('parseCSV', () => {
    it('should parse valid CSV content', () => {
      const csvContent = Buffer.from(
        'post_id,post_origin,cd_make,cd_model\n' +
          '12345,instagram,Toyota,Camry\n' +
          '67890,manual,Honda,Accord\n',
      );

      const rows = service.parseCSV(csvContent);

      expect(rows).toHaveLength(2);
      expect(rows[0].post_id).toBe('12345');
      expect(rows[0].cd_make).toBe('Toyota');
    });

    it('should throw BadRequestException for invalid CSV', () => {
      const invalidCSV = Buffer.from('invalid,csv,content\nwith,missing');

      // CSV with inconsistent column counts should throw
      expect(() => service.parseCSV(invalidCSV)).toThrow(
        BadRequestException,
      );
    });

    it('should handle boolean values correctly', () => {
      const csvContent = Buffer.from(
        'post_id,cd_published,cd_sold\n' +
          '12345,true,false\n' +
          '67890,1,0\n',
      );

      const rows = service.parseCSV(csvContent);

      expect(rows[0].cd_published).toBe(true);
      expect(rows[0].cd_sold).toBe(false);
      expect(rows[1].cd_published).toBe(true);
      expect(rows[1].cd_sold).toBe(false);
    });

    it('should handle null values correctly', () => {
      const csvContent = Buffer.from(
        'post_id,cd_make,cd_model\n' + '12345,,null\n',
      );

      const rows = service.parseCSV(csvContent);

      expect(rows[0].cd_make).toBeNull();
      expect(rows[0].cd_model).toBeNull();
    });
  });

  describe('processBulkImport', () => {
    it('should process CSV and return summary', async () => {
      const csvContent = Buffer.from(
        'post_id,post_origin,post_revalidate,post_dateCreated,post_caption,post_cleanedCaption,post_vendor_id,post_car_detail_id,post_status,cd_id,cd_published,cd_sold,cd_deleted,cd_make,cd_model\n' +
          '12345,instagram,false,2026-01-01,caption,cleaned,10,null,active,null,false,false,false,Toyota,Camry\n',
      );

      mockPrismaService.post.findUnique.mockResolvedValue({
        id: BigInt(12345),
        revalidate: false,
      });

      mockPrismaService.car_detail.create.mockResolvedValue({
        id: BigInt(Date.now()),
      });

      const summary = await service.processBulkImport(csvContent);

      expect(summary.created).toBe(1);
      expect(summary.updated).toBe(0);
      expect(summary.errors).toHaveLength(0);
    });

    it('should handle errors gracefully', async () => {
      const csvContent = Buffer.from(
        'post_id,post_origin,cd_make\n' + '999,instagram,Toyota\n',
      );

      mockPrismaService.post.findUnique.mockResolvedValue(null);

      const summary = await service.processBulkImport(csvContent);

      expect(summary.created).toBe(0);
      expect(summary.updated).toBe(0);
      expect(summary.errors.length).toBeGreaterThan(0);
      expect(summary.errors[0].error).toContain('not found');
    });
  });
});

