import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { stringify } from 'csv-stringify/sync';
import { parse } from 'csv-parse/sync';
import {
  BulkImportRow,
  BulkImportQueryResult,
} from './types/bulk-import.types';

/**
 * Service for bulk import/export operations with CSV files
 * Helps admins to populate car details from captions
 */
@Injectable()
export class BulkImportService {
  private readonly logger = new Logger(BulkImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetches posts and car details for export
   * @param limit Maximum number of rows to fetch (default: 100)
   * @returns Array of query results
   */
  async fetchPostsForExport(limit?: number): Promise<BulkImportQueryResult[]> {
    const actualLimit = limit ?? 100;

    this.logger.log(`Fetching ${actualLimit} posts for export`);

    // Execute the raw SQL query as specified
    const results: any[] = await this.prisma.$queryRawUnsafe(
      `
      SELECT
        p.id,
        p.origin,
        p.revalidate,
        p.dateCreated,
        p.car_detail_id,
        p.caption,
        p.cleanedCaption,
        p.vendor_id,
        p.status,

        cd.id          AS cd_id,
        cd.published   AS cd_published,
        cd.sold        AS cd_sold,
        cd.deleted     AS cd_deleted,
        cd.make        AS cd_make,
        cd.model       AS cd_model,
        cd.variant     AS cd_variant,
        cd.registration AS cd_registration,
        cd.mileage     AS cd_mileage,
        cd.transmission AS cd_transmission,
        cd.fuelType    AS cd_fuelType,
        cd.engineSize  AS cd_engineSize,
        cd.drivetrain  AS cd_drivetrain,
        cd.seats       AS cd_seats,
        cd.numberOfDoors AS cd_numberOfDoors,
        cd.bodyType    AS cd_bodyType,
        cd.customsPaid AS cd_customsPaid,
        cd.options     AS cd_options,
        cd.price       AS cd_price,
        cd.emissionGroup AS cd_emissionGroup,
        cd.type        AS cd_type,
        cd.contact     AS cd_contact,
        cd.priceVerified AS cd_priceVerified,
        cd.mileageVerified AS cd_mileageVerified,
        cd.country     AS cd_country,
        cd.city        AS cd_city,
        cd.countryOfOriginForVehicles AS cd_countryOfOriginForVehicles,
        cd.phoneNumber AS cd_phoneNumber,
        cd.whatsAppNumber AS cd_whatsAppNumber,
        cd.location    AS cd_location,

        ((cd.published = 0 OR cd.published IS NULL OR p.revalidate = 1)) AS grp1_pub_or_revalidate,
        ((cd.sold = 0 OR cd.sold IS NULL)) AS grp2_not_sold,
        ((cd.deleted = 0 OR cd.deleted IS NULL)) AS grp3_not_deleted,
        ((p.origin = 'manual' OR p.origin = 'instagram')) AS grp4_origin_ok,

        1 AS matches_query,
        (cd.id IS NULL) AS car_detail_missing

      FROM post p
      LEFT JOIN car_detail cd
        ON p.car_detail_id = cd.id
      WHERE
        (cd.published = 0 OR cd.published IS NULL OR p.revalidate = 1)
        AND (cd.sold = 0 OR cd.sold IS NULL)
        AND (cd.deleted = 0 OR cd.deleted IS NULL)
        AND (p.origin = 'manual' OR p.origin = 'instagram')
      ORDER BY p.dateCreated DESC
      LIMIT ?
    `,
      actualLimit,
    );

    this.logger.log(`Fetched ${results.length} posts`);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return results;
  }

  /**
   * Converts query results to CSV row format
   * @param results Query results from database
   * @returns Array of formatted rows
   */
  private convertToCSVRows(results: BulkImportQueryResult[]): BulkImportRow[] {
    return results.map((result) => ({
      // Post fields
      post_id: String(result.id),
      post_cleanedCaption: result.cleanedCaption,

      // Car detail fields
      cd_id: result.cd_id ? String(result.cd_id) : 'null',
      cd_make: result.cd_make,
      cd_model: result.cd_model,
      cd_variant: result.cd_variant,
      cd_registration: result.cd_registration,
      cd_mileage: result.cd_mileage,
      cd_transmission: result.cd_transmission,
      cd_fuelType: result.cd_fuelType,
      cd_engineSize: result.cd_engineSize,
      cd_drivetrain: result.cd_drivetrain,
      cd_seats: result.cd_seats,
      cd_numberOfDoors: result.cd_numberOfDoors,
      cd_bodyType: result.cd_bodyType,
      cd_customsPaid: result.cd_customsPaid,
      cd_options: result.cd_options,
      cd_price: result.cd_price,
      cd_emissionGroup: result.cd_emissionGroup,
      cd_type: result.cd_type,
      cd_contact:
        result.cd_contact && typeof result.cd_contact === 'object'
          ? JSON.stringify(result.cd_contact)
          : result.cd_contact,
      cd_priceVerified: result.cd_priceVerified,
      cd_mileageVerified: result.cd_mileageVerified,
      cd_country: result.cd_country,
      cd_city: result.cd_city,
      cd_countryOfOriginForVehicles: result.cd_countryOfOriginForVehicles,
      cd_phoneNumber: result.cd_phoneNumber,
      cd_whatsAppNumber: result.cd_whatsAppNumber,
      cd_location: result.cd_location,
    }));
  }

  /**
   * Generates CSV string from query results
   * @param limit Maximum number of rows to export
   * @returns CSV string
   */
  async generateCSV(limit?: number): Promise<string> {
    const results = await this.fetchPostsForExport(limit);
    const rows = this.convertToCSVRows(results);

    return stringify(rows, {
      header: true,
      quoted: true,
      quoted_empty: true,
      escape: '"',
    });
  }

  /**
   * Fetches published posts with complete car details for export
   * Excludes drafts, manual uploads, and posts without make/model
   * @param limit Maximum number of rows to fetch (optional - if not provided, fetches all)
   * @returns Array of query results
   */
  async fetchPublishedPostsForExport(
    limit?: number,
  ): Promise<BulkImportQueryResult[]> {
    const limitText = limit ? `${limit}` : 'ALL';
    this.logger.log(
      `Fetching ${limitText} published posts with car details for export`,
    );

    // Query for published posts with complete car details
    const query = `
      SELECT
        p.id,
        p.cleanedCaption,
        p.vendor_id,
        p.status,

        cd.make        AS cd_make,
        cd.model       AS cd_model,
        cd.variant     AS cd_variant,
        cd.registration AS cd_registration,
        cd.mileage     AS cd_mileage,
        cd.transmission AS cd_transmission,
        cd.fuelType    AS cd_fuelType,
        cd.engineSize  AS cd_engineSize,
        cd.drivetrain  AS cd_drivetrain,
        cd.seats       AS cd_seats,
        cd.numberOfDoors AS cd_numberOfDoors,
        cd.bodyType    AS cd_bodyType,
        cd.customsPaid AS cd_customsPaid,
        cd.price       AS cd_price,
        cd.emissionGroup AS cd_emissionGroup,
        cd.type        AS cd_type,
        cd.contact     AS cd_contact,
        cd.priceVerified AS cd_priceVerified,
        cd.mileageVerified AS cd_mileageVerified,
        cd.country     AS cd_country,
        cd.city        AS cd_city,
        cd.countryOfOriginForVehicles AS cd_countryOfOriginForVehicles,
        cd.phoneNumber AS cd_phoneNumber,
        cd.whatsAppNumber AS cd_whatsAppNumber,
        cd.location    AS cd_location,

        1 AS matches_query,
        0 AS car_detail_missing

      FROM post p
      INNER JOIN car_detail cd
        ON p.car_detail_id = cd.id
      WHERE
        p.status != 'DRAFT'
        AND p.origin != 'MANUAL'
        AND cd.make IS NOT NULL
        AND cd.make != ''
        AND cd.model IS NOT NULL
        AND cd.model != ''
      ORDER BY p.dateCreated DESC
    `;

    const results: any[] = limit
      ? await this.prisma.$queryRawUnsafe(`${query} LIMIT ?`, limit)
      : await this.prisma.$queryRawUnsafe(query);

    this.logger.log(
      `Fetched ${results.length} published posts with car details`,
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return results;
  }

  /**
   * Generates CSV string from published posts with car details
   * @param limit Maximum number of rows to export
   * @returns CSV string
   */
  async generatePublishedPostsCSV(limit?: number): Promise<string> {
    const results = await this.fetchPublishedPostsForExport(limit);
    const rows = this.convertToCSVRows(results);

    return stringify(rows, {
      header: true,
      quoted: true,
      quoted_empty: true,
      escape: '"',
    });
  }

  /**
   * Parses CSV content and validates it
   * @param csvContent CSV file content as buffer
   * @returns Parsed rows
   */
  parseCSV(csvContent: Buffer): BulkImportRow[] {
    try {
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        cast: (value, context) => {
          // Handle boolean values
          if (value === 'true' || value === '1') return true;
          if (value === 'false' || value === '0') return false;
          // Handle null/empty values
          if (value === '' || value === 'null') return null;
          // Handle numbers
          if (context.column && typeof context.column === 'string') {
            const columnName = context.column;
            if (
              columnName.includes('mileage') ||
              columnName.includes('price') ||
              columnName.includes('seats') ||
              columnName.includes('numberOfDoors')
            ) {
              const num = Number(value);
              return isNaN(num) ? null : num;
            }
          }
          return value;
        },
      }) as unknown as BulkImportRow[];

      this.logger.log(`Parsed ${records.length} rows from CSV`);
      return records;
    } catch (error) {
      this.logger.error('Failed to parse CSV', error);
      throw new BadRequestException('Invalid CSV format');
    }
  }

  /**
   * Processes bulk import from CSV
   * @param csvContent CSV file content
   * @returns Summary of operations
   */
  async processBulkImport(csvContent: Buffer): Promise<{
    created: number;
    updated: number;
    errors: Array<{ row: number; error: string }>;
  }> {
    const rows = this.parseCSV(csvContent);
    const summary = {
      created: 0,
      updated: 0,
      errors: [] as Array<{ row: number; error: string }>,
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        await this.processRow(row);

        // Determine if it was an update or create based on cd_id
        if (row.cd_id && row.cd_id !== 'null') {
          summary.updated++;
        } else {
          summary.created++;
        }
      } catch (error) {
        this.logger.error(`Error processing row ${i + 1}`, error);
        summary.errors.push({
          row: i + 1,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.logger.log(
      `Bulk import completed: ${summary.created} created, ${summary.updated} updated, ${summary.errors.length} errors`,
    );

    return summary;
  }

  /**
   * Processes a single row from CSV
   * @param row CSV row data
   */
  private async processRow(row: BulkImportRow): Promise<void> {
    const postId = BigInt(row.post_id);

    // Check if the post exists
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new Error(`Post with ID ${row.post_id} not found`);
    }

    // Prepare car_detail data
    const carDetailData = {
      make: row.cd_make,
      model: row.cd_model,
      variant: row.cd_variant,
      registration: row.cd_registration,
      mileage: row.cd_mileage !== null ? Number(row.cd_mileage) : null,
      transmission: row.cd_transmission,
      fuelType: row.cd_fuelType,
      engineSize: row.cd_engineSize,
      drivetrain: row.cd_drivetrain,
      seats: row.cd_seats !== null ? Number(row.cd_seats) : null,
      numberOfDoors:
        row.cd_numberOfDoors !== null ? Number(row.cd_numberOfDoors) : null,
      bodyType: row.cd_bodyType,
      customsPaid: row.cd_customsPaid === true,
      options: row.cd_options,
      price: row.cd_price !== null ? Number(row.cd_price) : null,
      emissionGroup: row.cd_emissionGroup,
      type: row.cd_type || 'car',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      contact: row.cd_contact ? this.parseJSON(row.cd_contact) : null,
      priceVerified: row.cd_priceVerified === true,
      mileageVerified: row.cd_mileageVerified === true,
      country: row.cd_country,
      city: row.cd_city,
      countryOfOriginForVehicles: row.cd_countryOfOriginForVehicles,
      phoneNumber: row.cd_phoneNumber,
      whatsAppNumber: row.cd_whatsAppNumber,
      location: row.cd_location,
      dateUpdated: new Date(),
    };

    // If car_detail exists, update it
    if (row.cd_id && row.cd_id !== 'null') {
      const carDetailId = BigInt(row.cd_id);

      await this.prisma.car_detail.update({
        where: { id: carDetailId },
        data: carDetailData,
      });

      this.logger.debug(`Updated car_detail ${carDetailId}`);
    } else {
      // Create new car_detail and link it to post
      const newCarDetail = await this.prisma.car_detail.create({
        data: {
          ...carDetailData,
          id: BigInt(Date.now()), // Generate a new ID
          dateCreated: new Date(),
          post_post_car_detail_idTocar_detail: {
            connect: { id: postId },
          },
        },
      });

      this.logger.debug(
        `Created car_detail ${newCarDetail.id} for post ${postId}`,
      );
    }
  }

  /**
   * Safely parse JSON strings
   * @param value String value that might be JSON
   * @returns Parsed object or null
   */
  private parseJSON(value: string | null): any {
    if (!value || value === 'null') return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}
