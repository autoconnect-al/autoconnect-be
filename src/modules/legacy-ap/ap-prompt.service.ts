import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { legacyError, legacySuccess } from '../../common/legacy-response';
import { decodeCaption, isCustomsPaid } from '../imports/utils/caption-processor';
import { sanitizePostUpdateDataForSource } from '../../common/promotion-field-guard.util';

@Injectable()
export class ApPromptService {
  constructor(private readonly prisma: PrismaService) {}

  async generatePrompt(length: number, mode: string) {
    const safeLength =
      Number.isFinite(length) && length > 0 ? Math.trunc(length) : 3700;
    const modeNormalized = mode.toLowerCase();

    if (modeNormalized === 'variant') {
      const prompt = await this.generateVariantPrompt(safeLength);
      return prompt;
    }

    if (modeNormalized === 'registration') {
      return this.generateRegistrationPrompt(safeLength);
    }
    if (modeNormalized === 'mileage') {
      return this.generateMileagePrompt(safeLength);
    }
    if (modeNormalized === 'price') {
      return this.generatePricePrompt(safeLength);
    }
    if (modeNormalized === 'motorcycle') {
      return this.generateMotorcyclePrompt(safeLength);
    }
    return this.generateGeneralPrompt(safeLength);
  }

  async getManualDraftPosts() {
    const rows = await this.prisma.post.findMany({
      where: {
        deleted: false,
        origin: 'MANUAL',
        status: 'DRAFT',
      },
      include: {
        car_detail_car_detail_post_idTopost: true,
      },
      orderBy: { dateUpdated: 'desc' },
      take: 200,
    });

    const mapped = rows.map((row) => {
      const details = row.car_detail_car_detail_post_idTopost?.[0] ?? null;
      return this.normalizeBigInts({
        ...row,
        caption: row.caption
          ? Buffer.from(row.caption, 'base64').toString('utf8')
          : row.caption,
        details,
      });
    });

    return legacySuccess(
      mapped,
      mapped.length
        ? 'Found manual draft posts'
        : 'No manual draft posts found',
    );
  }

  async importPromptResults(resultJson: string) {
    let parsed: Array<Record<string, unknown>> = [];
    try {
      const value = JSON.parse(resultJson);
      if (Array.isArray(value)) {
        parsed = value as Array<Record<string, unknown>>;
      }
    } catch {
      return legacyError('Exception occurred while importing result');
    }

    for (const result of parsed) {
      const id = this.toSafeString(result.id);
      if (!id) continue;

      const model = this.toSafeNullableString(result.model);
      const make = this.toSafeNullableString(result.make);
      const sold = this.booleanFrom(result.sold, false);
      if ((!model && !make) || sold) {
        await this.prisma.post.update({
          where: { id: BigInt(id) },
          data: { deleted: true, dateUpdated: new Date() },
        });
        await this.prisma.car_detail.updateMany({
          where: {
            OR: [{ id: BigInt(id) }, { post_id: BigInt(id) }],
          },
          data: { deleted: true, dateUpdated: new Date() },
        });
        continue;
      }

      const postId = BigInt(id);
      // Prefer the row linked by post_id because /post/posts reads from that relation.
      const carDetail =
        (await this.prisma.car_detail.findFirst({
          where: { post_id: postId },
          orderBy: [{ dateUpdated: 'desc' }, { id: 'desc' }],
        })) ??
        (await this.prisma.car_detail.findUnique({
          where: { id: postId },
        }));
      if (!carDetail) continue;

      await this.prisma.car_detail.update({
        where: { id: carDetail.id },
        data: {
          make: make ?? carDetail.make,
          model: model ?? carDetail.model,
          variant:
            this.toSafeNullableString(result.variant) ?? carDetail.variant,
          registration:
            (this.toNullableInt(result.registration)?.toString() ??
              this.toSafeNullableString(result.registration)) ??
            carDetail.registration,
          mileage: this.toNullableFloat(result.mileage) ?? carDetail.mileage,
          transmission:
            this.toSafeNullableString(result.transmission) ??
            carDetail.transmission,
          fuelType:
            this.toSafeNullableString(result.fuelType) ?? carDetail.fuelType,
          engineSize:
            this.toSafeNullableNumericString(result.engineSize) ??
            carDetail.engineSize,
          drivetrain:
            this.toSafeNullableString(result.drivetrain) ??
            carDetail.drivetrain,
          seats: this.toNullableInt(result.seats) ?? carDetail.seats,
          numberOfDoors:
            this.toNullableInt(result.numberOfDoors) ?? carDetail.numberOfDoors,
          bodyType:
            this.toSafeNullableString(result.bodyType) ?? carDetail.bodyType,
          price: this.toNullableFloat(result.price) ?? carDetail.price,
          sold: this.booleanFrom(result.sold, carDetail.sold ?? false),
          customsPaid: this.resolveCustomsPaid(result),
          priceVerified: this.booleanFrom(
            result.priceVerified,
            carDetail.priceVerified ?? false,
          ),
          mileageVerified: this.booleanFrom(
            result.mileageVerified,
            carDetail.mileageVerified ?? false,
          ),
          fuelVerified: this.booleanFrom(
            result.fuelVerified,
            carDetail.fuelVerified ?? false,
          ),
          contact: result.contact
            ? JSON.stringify(result.contact)
            : carDetail.contact,
          published: true,
          type: this.toSafeString(result.type) || carDetail.type,
          dateUpdated: new Date(),
        },
      });

      const postUpdateData = sanitizePostUpdateDataForSource(
        {
          live: true,
          revalidate: false,
          origin: this.toSafeString(result.origin) || undefined,
          status: this.toSafeString(result.status) || undefined,
          renewTo: this.toNullableInt(result.renewTo) ?? undefined,
          highlightedTo: this.toNullableInt(result.highlightedTo) ?? undefined,
          promotionTo: this.toNullableInt(result.promotionTo) ?? undefined,
          mostWantedTo: this.toNullableInt(result.mostWantedTo) ?? undefined,
          dateUpdated: new Date(),
        },
        'untrusted',
      );
      await this.prisma.post.update({
        where: { id: BigInt(id) },
        data: postUpdateData,
      });
    }

    // await this.rebuildSearchFromPosts();
    return legacySuccess(null, 'Updated car detail');
  }

  async cleanCache() {
    const apiKey = this.toSafeString(
      process.env.NEXTJS_CACHE_API_KEY ??
        process.env.NEXT_CACHE_API_KEY ??
        process.env.CACHE_API_KEY,
    );
    if (!apiKey) {
      return legacyError('Failed to clean cache');
    }

    const endpoint =
      this.toSafeString(process.env.BASE_URL) || 'http://localhost:3000';

    const recentlyDeleted = await this.prisma.post.findMany({
      where: {
        deleted: true,
        dateUpdated: {
          gte: new Date(Date.now() - 2 * 24 * 3600 * 1000),
        },
      },
      select: { id: true },
      take: 1000,
    });

    const ids = recentlyDeleted.map((row) => String(row.id)).join(',');
    const url = new URL('/api/cache', endpoint);
    url.searchParams.set('apiKey', apiKey);
    url.searchParams.set('postIds', ids);

    try {
      const response = await fetch(url.toString(), { method: 'GET' });
      const text = await response.text();
      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text);
      } catch {
        // keep raw text
      }
      return legacySuccess(parsed, 'Cache cleaned successfully');
    } catch {
      return legacyError('Failed to clean cache');
    }
  }

  private async generateVariantPrompt(length: number): Promise<{
    prompt: string;
    size: number;
  }> {
    const problematicMakes = await this.prisma.$queryRawUnsafe<
      Array<{ make: string | null }>
    >(
      `
      SELECT cd.make
      FROM car_detail cd
      LEFT JOIN post p ON p.id = post_id
      WHERE FROM_UNIXTIME(p.createdTime) > DATE_SUB(NOW(), INTERVAL 3 MONTH)
        AND p.deleted = 0
        AND p.live = 1
        AND cd.deleted = 0
        AND cd.published = 1
        AND cd.sold = 0
        AND p.origin != 'manual'
        AND (
          (cd.model NOT IN (SELECT REPLACE(cmm.Model, ' (all)', '') FROM car_make_model cmm WHERE cmm.isVariant = 0) AND cd.model != 'Others')
          OR (
            cd.make IN ('Mercedes-Benz', 'BMW', 'Lexus', 'Porsche', 'Citroen')
            AND cd.variant NOT RLIKE (
              SELECT GROUP_CONCAT(REPLACE(cmm.Model, '  ', '') SEPARATOR '|')
              FROM car_make_model cmm
              WHERE cmm.Make = cd.make
                AND cmm.isVariant = 1
                AND (
                  cmm.Model LIKE CONCAT(REPLACE(cd.model, '-Class', ''), ' %')
                  OR cmm.Model LIKE CONCAT(REPLACE(cd.model, '-Class', ''), '%')
                )
            )
          )
          OR engineSize > 10
          OR bodyType IS NULL
          OR (
            type = 'car'
            AND bodyType NOT IN ('Compact', 'Convertible', 'Coupe', 'SUV/Off-Road/Pick-up', 'Station wagon', 'Sedans', 'Van', 'Transporter', 'Other')
          )
          OR (
            type = 'motorcycle'
            AND bodyType NOT IN ('Supersport', 'Sport touring', 'Chopper/Cruiser', 'Touring Enduro', 'Streetfighter', 'Enduro Bike', 'Motocrosser', 'Sidecar', 'Classic', 'Three Wheeler', 'Scooter', 'Moped', 'Super Moto', 'Minibike', 'Naked Bike', 'Quad', 'Rally', 'Trials Bike', 'Racing', 'Tourer', 'Others')
          )
          OR fuelType NOT IN ('petrol', 'petrol-gas', 'gas', 'diesel', 'electric', 'hybrid')
          OR fuelType IS NULL
        )
      ORDER BY cd.make
      `,
    );

    const chunkSize = Math.max(1, length);
    for (const makeRow of problematicMakes) {
      const make = this.toSafeString(makeRow.make);
      if (!make) continue;

      const models = await this.prisma.$queryRawUnsafe<
        Array<{ model: string | null; isVariant: number | boolean | null }>
      >(
        'SELECT DISTINCT model, isVariant FROM car_make_model WHERE make = ? ORDER BY id',
        make,
      );
      if (models.length === 0) continue;

      const problems = await this.prisma.$queryRawUnsafe<
        Array<{
          id: bigint;
          make: string | null;
          model: string | null;
          variant: string | null;
          bodyType: string | null;
          fuelType: string | null;
          engineSize: string | null;
        }>
      >(
        `
        SELECT cd.id, cd.make, cd.model, cd.variant, bodyType, fuelType, engineSize
        FROM car_detail cd
        LEFT JOIN post p ON p.id = post_id
        WHERE FROM_UNIXTIME(p.createdTime) > DATE_SUB(NOW(), INTERVAL 3 MONTH)
          AND p.deleted = 0
          AND p.live = 1
          AND cd.deleted = 0
          AND cd.published = 1
          AND cd.sold = 0
          AND cd.make = ?
          AND p.vendor_id != 1
          AND (
            (cd.model NOT IN (SELECT REPLACE(cmm.Model, ' (all)', '') FROM car_make_model cmm WHERE cmm.Make = ? AND cmm.isVariant = 0) AND cd.model != 'Other')
            OR (
              cd.make IN ('Mercedes-Benz', 'BMW', 'Lexus', 'Porsche', 'Citroen')
              AND cd.variant IS NOT NULL
              AND cd.variant NOT RLIKE (
                SELECT GROUP_CONCAT(REPLACE(cmm.Model, '  ', '') SEPARATOR '|')
                FROM car_make_model cmm
                WHERE cmm.Make = cd.make
                  AND cmm.isVariant = 1
                  AND (
                    cmm.Model LIKE CONCAT(REPLACE(cd.model, '-Class', ''), ' %')
                    OR cmm.Model LIKE CONCAT(REPLACE(cd.model, '-Class', ''), '%')
                  )
              )
            )
            OR engineSize > 10
            OR bodyType IS NULL
            OR (
              type = 'car'
              AND bodyType NOT IN ('Compact', 'Convertible', 'Coupe', 'SUV/Off-Road/Pick-up', 'Station wagon', 'Sedans', 'Van', 'Transporter', 'Other')
            )
            OR (
              type = 'motorcycle'
              AND bodyType NOT IN ('Supersport', 'Sport touring', 'Chopper/Cruiser', 'Touring Enduro', 'Streetfighter', 'Enduro Bike', 'Motocrosser', 'Sidecar', 'Classic', 'Three Wheeler', 'Scooter', 'Moped', 'Super Moto', 'Minibike', 'Naked Bike', 'Quad', 'Rally', 'Trials Bike', 'Racing', 'Tourer', 'Others')
            )
            OR fuelType NOT IN ('petrol', 'petrol-gas', 'gas', 'diesel', 'electric', 'hybrid')
            OR fuelType IS NULL
          )
        `,
        make,
        make,
      );

      if (problems.length === 0) continue;

      const baseModels = models
        .filter((m) => Number(m.isVariant ?? 0) === 0 && m.model)
        .map((m) => this.toSafeString(m.model).replace(' (all)', ''))
        .filter(Boolean);
      const variants = models
        .filter((m) => Number(m.isVariant ?? 0) !== 0 && m.model)
        .map((m) => this.toSafeString(m.model).replace(' (all)', ''))
        .filter(Boolean);

      const chunks: string[][] = [];
      let buffer: string[] = [];
      for (const item of problems) {
        buffer.push(
          JSON.stringify({
            id: String(item.id),
            make: this.toSafeString(item.make),
            model: this.toSafeString(item.model),
            variant: this.toSafeString(item.variant),
            bodyType: this.toSafeString(item.bodyType),
            fuelType: this.toSafeString(item.fuelType),
            engineSize: item.engineSize,
          }),
        );
        if (buffer.length === chunkSize) {
          chunks.push(buffer);
          buffer = [];
        }
      }
      if (buffer.length > 0) chunks.push(buffer);

      const firstPromptData = chunks[0] ?? [];
      const listPrompt = this.normalizePromptWhitespace(
        `[${firstPromptData.join(', ')}]`,
      );

      const modelFixTemplate = `Hello. I want you to process a list of JSON objects.
        I want you to keep the same structure but map the model property to one of these: [{models}].
        {variantPrompt}
        Copy the id as string.
        Fill bodyType, fuelType and engineSize based on the model and variant values.
        If the type is car, body type should be one of: [Compact, Convertible, Coupe, SUV/Off-Road/Pick-up, Station wagon, Sedans, Van, Transporter, Other].
        If the type is motorcycle, body type should be one of: [Supersport, Sport touring, Chopper/Cruiser, Touring Enduro, Streetfighter, Enduro Bike, Motocrosser, Sidecar, Classic, Three Wheeler, Scooter, Moped, Super Moto, Minibike, Naked Bike, Quad, Rally, Trials Bike, Racing, Tourer, Others].        Fuel type should be one of: petrol, petrol-gas, gas, diesel, electric, hybrid.
        Engine size should be a float number.`;

      const variantPrompt = variants.length
        ? `Try to map the variant to one of these: ${variants.join(', ')}.`
        : '';
      const modelFixPrompt = modelFixTemplate
        .replace('{models}', baseModels.join(', '))
        .replace('{variantPrompt}', variantPrompt);

      return {
        prompt: `${modelFixPrompt} Here is another list. Please do the same: ${listPrompt}`,
        size: problems.length,
      };
    }

    return { prompt: '', size: 0 };
  }

  private async generateGeneralPrompt(length: number): Promise<{
    prompt: string;
    size: number;
  }> {
    const prerequisite = `Can you please provide details in a JSON list containing the following fields: 
    id: as string, 
    make: Try to map the model to the official one. Use autoscout24.com for reference, 
    model: Try to map the model to the official one. Use autoscout24.com for reference. Model should not include variant like CDI, TDI, L, d, i, ci etc., 
    variant: Try to map the variant to the official one,
    registration: only the year as number, 
    mileage: only number, 
    bodyType: string,
    price: only number, 
    transmission: automatic, manual or semi-automatic
    fuelType: petrol, petrol-gas, gas, diesel, electric or hybrid
    engineSize: only float number, 
    emissionGroup: one of Euro 1, Euro 2, Euro 3, Euro 4, Euro 5, Euro 6
    drivetrain: 2WD, 4WD, AWD, FWD, RWD or 4x4,
    type: car, motorcycle, truck, boat, other
    and contact: {
        phone_number: as string,
        whatsapp: as string,
        address: as string
    }. 
    If the type is car, body type should be one of: [Compact, Convertible, Coupe, SUV/Off-Road/Pick-up, Station wagon, Sedans, Van, Transporter, Other].
    If the type is motorcycle, body type should be one of: [Supersport, Sport touring, Chopper/Cruiser, Touring Enduro, Streetfighter, Enduro Bike, Motocrosser, Sidecar, Classic, Three Wheeler, Scooter, Moped, Super Moto, Minibike, Naked Bike, Quad, Rally, Trials Bike, Racing, Tourer, Others].
    Try to fill the unknown values based on your knowledge of the make and model. 
`;
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ id: bigint; cleanedCaption: string | null }>
    >(
      `
      SELECT p.id, p.cleanedCaption
      FROM post p
      LEFT JOIN car_detail cd ON cd.post_id = p.id
      WHERE (cd.published = 0 OR cd.published IS NULL OR p.revalidate = 1)
        AND (cd.sold = 0 OR cd.sold IS NULL)
        AND (cd.deleted = 0 OR cd.deleted IS NULL)
        AND (p.origin = 'manual' OR p.origin = 'instagram')
        AND (p.deleted = 0 OR p.deleted IS NULL)
      ORDER BY p.dateCreated DESC
      `,
    );
    const captions = rows.map(
      (row) =>
        `" id: ${String(row.id)} - ${this.toSafeString(row.cleanedCaption)}"`,
    );
    const firstPrompt = this.buildFirstPromptChunk(captions, length);
    return {
      prompt: rows.length
        ? `${prerequisite}Here is another list: ${firstPrompt}`
        : '',
      size: rows.length,
    };
  }

  private async generateRegistrationPrompt(length: number): Promise<{
    prompt: string;
    size: number;
  }> {
    const prerequisite = `I would like you to fix the contact information, add numberOfDoors and seats. 
    For contact information, try to fill address, phone_number and whatsapp based on caption.
    Do not change the other details.
    Use the information from the caption to fill this detail. 
    Please provide a json array with the following format:
        {
            id: string,
            make: string,
            model: string,
            contact: {phone_number: string, whatsapp: string, address: string},
            numberOfDoors: int,
            seats: int,
            emissionGroup: one of Euro 1, Euro 2, Euro 3, Euro 4, Euro 5, Euro 6,
            drivetrain: 2WD, 4WD, AWD, FWD, RWD or 4x4,
            engineSize: float,
        }. `;
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: bigint;
        make: string | null;
        model: string | null;
        cleanedCaption: string | null;
        contact: string | null;
      }>
    >(
      `
      SELECT
        cd.id,
        cd.make,
        cd.model,
        p.cleanedCaption,
        cd.contact
      FROM post p
      JOIN car_detail cd ON cd.post_id = p.id
      WHERE
        cd.deleted = 0
        AND cd.published = 1
        AND cd.sold = 0
        AND cd.type = 'car'
        AND p.deleted = 0
        AND p.live = 1
        AND p.origin <> 'manual'
        AND p.vendor_id <> 1
        AND p.createdTime >= UNIX_TIMESTAMP(NOW() - INTERVAL 3 MONTH)
        AND (
          p.status = 'DRAFT'
          OR cd.contact IS NULL
          OR cd.contact NOT LIKE '%{%'
          OR cd.contact LIKE '%unknown%'
          OR cd.contact LIKE '%provided%'
          OR cd.contact LIKE '%null%'
          OR cd.contact LIKE '%www%'
          OR cd.contact LIKE '%http%'
          OR (
            cd.contact LIKE '%"phone_number": "%'
            AND cd.contact NOT LIKE '%"phone_number": ""%'
            AND (
              (
                cd.contact NOT LIKE '%"phone_number": "+355%'
                AND cd.contact NOT LIKE '%"phone_number": "068%'
                AND cd.contact NOT LIKE '%"phone_number": "069%'
                AND cd.contact NOT LIKE '%"phone_number": "067%'
                AND cd.contact NOT LIKE '%"phone_number": "06%'
                AND cd.contact NOT LIKE '%"phone_number": "04%'
                AND cd.contact NOT LIKE '%"phone_number": "+49%'
                AND cd.contact NOT LIKE '%"phone_number": "+44%'
                AND cd.contact NOT LIKE '%"phone_number": "+82%'
                AND cd.contact NOT LIKE '%"phone_number": "+1%'
                AND cd.contact NOT LIKE '%"phone_number": "+39%'
                AND cd.contact NOT LIKE '%"phone_number": "+38%'
                AND cd.contact NOT LIKE '%"phone_number": "+97%'
                AND cd.contact NOT LIKE '%"phone_number": "+46%'
                AND cd.contact NOT LIKE '%"phone_number": "+43%'
                AND cd.contact NOT LIKE '%"phone_number": "+79%'
                AND cd.contact NOT LIKE '%"phone_number": "+34%'
                AND cd.contact NOT LIKE '%"phone_number": "+32%'
                AND cd.contact NOT LIKE '%"phone_number": "+30%'
                AND cd.contact NOT LIKE '%"phone_number": "+33%'
              )
              OR cd.contact LIKE '%"phone_number": "+35506%'
              OR cd.contact LIKE '%"phone_number": "+3869%'
              OR cd.contact LIKE '%"phone_number": "+3868%'
              OR cd.contact LIKE '%"phone_number": "+3867%'
              OR cd.contact LIKE '%"phone_number": "+3969%'
            )
          )
          OR cd.drivetrain IS NULL
          OR cd.drivetrain = ''
          OR cd.drivetrain NOT IN ('2WD','4WD','AWD','FWD','RWD','4x4')
          OR cd.numberOfDoors IS NULL
          OR cd.numberOfDoors = ''
          OR cd.seats IS NULL
          OR cd.seats = ''
          OR cd.bodyType IS NULL
          OR cd.bodyType = ''
          OR cd.bodyType = 'other'
          OR (
            cd.registration < 2022
            AND cd.mileage > 0
            AND cd.mileage < 10000
            AND (cd.mileageVerified = 0 OR cd.mileageVerified IS NULL)
          )
          OR (
            cd.registration < 2022
            AND cd.price > 0
            AND cd.price < 1100
            AND (cd.priceVerified = 0 OR cd.priceVerified IS NULL)
          )
          OR (
            cd.registration < 2022
            AND cd.price > 100000
            AND (cd.priceVerified = 0 OR cd.priceVerified IS NULL)
          )
          OR cd.variant LIKE '%viti%'
          OR cd.contact LIKE '%viti%'
          OR (
            cd.fuelType = 'diesel'
            AND (cd.fuelVerified = 0 OR cd.fuelVerified IS NULL)
            AND p.cleanedCaption NOT REGEXP '[0-9]+ *d'
            AND cd.model NOT REGEXP '[0-9]+ *d'
            AND cd.variant NOT REGEXP '[0-9]+ *d'
            AND (
              LOWER(p.cleanedCaption) NOT REGEXP '(naft(e|a)?|dizel|diezel|diesel|tdi|cdi|tdci|hdi|dci|cdti|jtd|multijet|crdi|d-4d|d4d|sdv6|tdv6|(^|[^a-z0-9])d4([^a-z0-9]|$))'
              AND LOWER(cd.variant) NOT REGEXP '(dizel|diezel|diesel|tdi|cdi|tdci|hdi|dci|cdti|jtd|multijet|crdi|d-4d|d4d|sdv6|tdv6|(^|[^a-z0-9])d4([^a-z0-9]|$))'
            )
          )
          OR (
            cd.fuelType = 'petrol'
            AND (cd.fuelVerified = 0 OR cd.fuelVerified IS NULL)
            AND p.cleanedCaption NOT REGEXP '[0-9]+ *(i|li)'
            AND cd.model NOT REGEXP '[0-9]+ *(i|li)'
            AND cd.variant NOT REGEXP '[0-9]+ *(i|li)'
            AND p.cleanedCaption NOT REGEXP '(SQ|RS Q|RS|S)[0-9]'
            AND cd.model NOT REGEXP '(SQ|RS Q|RS|S)[0-9]'
            AND cd.variant NOT REGEXP '(SQ|RS Q|RS|S)[0-9]'
            AND LOWER(p.cleanedCaption) NOT REGEXP '(^|[^a-z0-9])(amg|v8|v10|v12)([^a-z0-9]|$)'
            AND LOWER(cd.variant) NOT REGEXP '(^|[^a-z0-9])(amg|v8|v10|v12)([^a-z0-9]|$)'
            AND LOWER(p.cleanedCaption) NOT REGEXP '(^|[^0-9])(6\\.2|6\\.3|5\\.5|5\\.0|4\\.0)([^0-9]|$)'
            AND LOWER(cd.variant) NOT REGEXP '(^|[^0-9])(6\\.2|6\\.3|5\\.5|5\\.0|4\\.0)([^0-9]|$)'
            AND NOT (
              LOWER(cd.variant) REGEXP '(^|[^0-9])63([^0-9]|$)'
              AND LOWER(cd.variant) REGEXP 'amg'
            )
            AND (
              LOWER(p.cleanedCaption) NOT REGEXP '(benzin|benzine|petrol|gasoline|bencin|benxin|benzina|essence)'
              AND LOWER(cd.model) NOT REGEXP '(benzin|benzine|petrol|gasoline|bencin|benxin|benzina|essence)'
              AND LOWER(cd.variant) NOT REGEXP '(benzin|benzine|petrol|gasoline|bencin|benxin|benzina|essence)'
              AND LOWER(p.cleanedCaption) NOT REGEXP '(^|[^a-z0-9])(fsi|tfsi|tsi|gti|t-?jet|ecoboost|turbo|kompressor|skyactiv-g|vtec|valvematic|vvt-i)([^a-z0-9]|$)'
              AND LOWER(cd.model) NOT REGEXP '(^|[^a-z0-9])(fsi|tfsi|tsi|gti|t-?jet|ecoboost|turbo|kompressor|skyactiv-g|vtec|valvematic|vvt-i)([^a-z0-9]|$)'
              AND LOWER(cd.variant) NOT REGEXP '(^|[^a-z0-9])(fsi|tfsi|tsi|gti|t-?jet|ecoboost|turbo|kompressor|skyactiv-g|vtec|valvematic|vvt-i)([^a-z0-9]|$)'
              AND LOWER(p.cleanedCaption) NOT REGEXP '(^|[^0-9])([0-9]\\.[0-9]|[1-6]\\.[0-9])\\s*(i|fsi|tfsi|tsi)([^a-z0-9]|$)'
              AND LOWER(cd.model) NOT REGEXP '(^|[^0-9])([0-9]\\.[0-9]|[1-6]\\.[0-9])\\s*(i|fsi|tfsi|tsi)([^a-z0-9]|$)'
              AND LOWER(cd.variant) NOT REGEXP '(^|[^0-9])([0-9]\\.[0-9]|[1-6]\\.[0-9])\\s*(i|fsi|tfsi|tsi)([^a-z0-9]|$)'
              AND LOWER(p.cleanedCaption) NOT REGEXP '(^|[^0-9])(16i|18i|20i|23i|25i|28i|30i|35i|40i|45i|50i)([^a-z0-9]|$)'
              AND LOWER(cd.model) NOT REGEXP '(^|[^0-9])(16i|18i|20i|23i|25i|28i|30i|35i|40i|45i|50i)([^a-z0-9]|$)'
              AND LOWER(cd.variant) NOT REGEXP '(^|[^0-9])(16i|18i|20i|23i|25i|28i|30i|35i|40i|45i|50i)([^a-z0-9]|$)'
            )
          )
        )
      `,
    );
    const captions = rows.map(
      (row) => `{
                            id: ${String(row.id)}
                            , make: ${this.toSafeString(row.make)}
                            , model: ${this.toSafeString(row.model)}
                            , contact: ${this.toSafeString(row.contact)}
                            , caption: ${this.toSafeString(row.cleanedCaption)}
                            }`,
    );
    const firstPrompt = this.buildFirstPromptChunk(captions, length);
    return {
      prompt: rows.length
        ? `${prerequisite}Here is another list: ${firstPrompt}`
        : '',
      size: rows.length,
    };
  }

  private async generateMileagePrompt(length: number): Promise<{
    prompt: string;
    size: number;
  }> {
    const prerequisite = `I would like you to fix the mileage information. 
    Do not change the other details.
    Use the information from the caption to fill this detail. 
    Please provide a json array with the following format:
        {
            id: string,
            make: string,
            model: string,
            mileage: int,
            emissionGroup: one of Euro 1, Euro 2, Euro 3, Euro 4, Euro 5, Euro 6,
        }. `;
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: bigint;
        cleanedCaption: string | null;
        make: string | null;
        model: string | null;
        registration: string | number | null;
        fuelType: string | null;
      }>
    >(
      `
      SELECT
        p.id,
        p.cleanedCaption,
        cd.mileage,
        cd.price,
        cd.sold,
        cd.make,
        cd.model,
        cd.registration,
        cd.fuelType,
        cd.emissionGroup
      FROM car_detail cd
      LEFT JOIN post p ON cd.post_id = p.id
      WHERE
        FROM_UNIXTIME(p.createdTime) > DATE_SUB(NOW(), INTERVAL 3 MONTH)
        AND cd.deleted = 0
        AND cd.published = 1
        AND p.deleted = 0
        AND p.live = 1
        AND cd.mileage > 0
        AND cd.mileage < 1000
        AND cd.sold = 0
        AND p.origin != 'manual'
        AND (cd.mileageVerified = 0 OR cd.mileageVerified IS NULL)
        AND (
          cd.price = cd.mileage
          OR (
            p.cleanedCaption NOT LIKE CONCAT('%', FORMAT(cd.mileage, 0, 'de_DE'), '%')
            AND p.cleanedCaption NOT LIKE CONCAT('%', FORMAT(cd.mileage, 0, 'en_US'), '%')
            AND p.cleanedCaption NOT LIKE CONCAT('%', cd.mileage, '%')
            AND REPLACE(p.cleanedCaption, ' ', '') NOT LIKE CONCAT('%', cd.mileage, '%')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.mileage DIV 1000, '\\s*mij([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.mileage DIV 1000, '\\s*mi([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.mileage DIV 1000, '\\s*Mij([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.mileage DIV 1000, '\\s*mije([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.mileage DIV 1000, '\\s*Mije([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.mileage DIV 1000, '\\s* mij([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.mileage DIV 1000, '\\s* mi([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.mileage DIV 1000, '\\s* Mij([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.mileage DIV 1000, '\\s* mije([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.mileage DIV 1000, '\\s* Mije([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.mileage DIV 1000, '\\s*k([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.mileage DIV 1000, '\\s*K([^a-zA-Z]|$)')
          )
        )
      ORDER BY cd.mileage
      `,
    );
    const captions = rows.map(
      (row) => `{
                            id: ${String(row.id)}
                            , make: ${this.toSafeString(row.make)}
                            , model: ${this.toSafeString(row.model)}
                            , registration: ${this.toSafeString(row.registration)}
                            , fuelType: ${this.toSafeString(row.fuelType)}
                            , caption: ${this.toSafeString(row.cleanedCaption)}
                            }`,
    );
    const firstPrompt = this.buildFirstPromptChunk(captions, length);
    return {
      prompt: rows.length
        ? `${prerequisite}Here is another list: ${firstPrompt}`
        : '',
      size: rows.length,
    };
  }

  private async generatePricePrompt(length: number): Promise<{
    prompt: string;
    size: number;
  }> {
    const prerequisite = `I would like you to fix the price information. 
    Do not change the other details.
    Use the information from the caption to fill this detail. 
    Please provide a json array with the following format:
        {
            id: string,
            make: string,
            model: string,
            price: int,
            emissionGroup: one of Euro 1, Euro 2, Euro 3, Euro 4, Euro 5, Euro 6,
        }. `;
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: bigint;
        cleanedCaption: string | null;
        make: string | null;
        model: string | null;
        registration: string | number | null;
        fuelType: string | null;
      }>
    >(
      `
      SELECT
        cd.id,
        p.cleanedCaption,
        cd.mileage,
        cd.price,
        cd.sold,
        cd.make,
        cd.model,
        cd.registration,
        cd.fuelType,
        cd.emissionGroup
      FROM car_detail cd
      LEFT JOIN post p ON cd.post_id = p.id
      LEFT JOIN vendor v ON v.id = p.vendor_id
      WHERE
        FROM_UNIXTIME(p.createdTime) > DATE_SUB(NOW(), INTERVAL 3 MONTH)
        AND cd.deleted = 0
        AND cd.published = 1
        AND p.deleted = 0
        AND p.live = 1
        AND cd.price > 0
        AND cd.sold = 0
        AND p.origin != 'manual'
        AND p.vendor_id != 1
        AND (cd.priceVerified = 0 OR cd.priceVerified IS NULL)
        AND (
          cd.price = cd.mileage
          OR (
            p.cleanedCaption NOT LIKE CONCAT('%', FORMAT(cd.price, 0, 'de_DE'), '%')
            AND p.cleanedCaption NOT LIKE CONCAT('%', FORMAT(cd.price, 0, 'en_US'), '%')
            AND p.cleanedCaption NOT LIKE CONCAT('%', cd.price, '%')
            AND REPLACE(p.cleanedCaption, ' ', '') NOT LIKE CONCAT('%', cd.price, '%')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.price DIV 1000, '\\s*mij([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.price DIV 1000, '\\s*mi([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.price DIV 1000, '\\s*Mij([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.price DIV 1000, '\\s*mije([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.price DIV 1000, '\\s*Mije([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.price DIV 1000, '\\s* mij([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.price DIV 1000, '\\s* mi([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.price DIV 1000, '\\s* Mij([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.price DIV 1000, '\\s* mije([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.price DIV 1000, '\\s* Mije([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.price DIV 1000, '\\s*k([^a-zA-Z]|$)')
            AND p.cleanedCaption NOT REGEXP CONCAT('(^|[^0-9])', cd.price DIV 1000, '\\s*K([^a-zA-Z]|$)')
          )
        )
      ORDER BY cd.price
      `,
    );
    const captions = rows.map(
      (row) => `{
                            id: ${String(row.id)}
                            , make: ${this.toSafeString(row.make)}
                            , model: ${this.toSafeString(row.model)}
                            , registration: ${this.toSafeString(row.registration)}
                            , fuelType: ${this.toSafeString(row.fuelType)}
                            , caption: ${this.toSafeString(row.cleanedCaption)}
                            }`,
    );
    const firstPrompt = this.buildFirstPromptChunk(captions, length);
    return {
      prompt: rows.length
        ? `${prerequisite}Here is another list: ${firstPrompt}`
        : '',
      size: rows.length,
    };
  }

  private async generateMotorcyclePrompt(length: number): Promise<{
    prompt: string;
    size: number;
  }> {
    const prerequisite = `I would like you to fix the contact information and other details. 
    For contact information, try to fill address, phone_number and whatsapp based on caption.
    Do not change the other details.
    Use the information from the caption to fill this detail. 
    Please provide a json array with the following format:
        {
            id: string,
            make: string,
            model: string,
            contact: {phone_number: string, whatsapp: string, address: string},
            numberOfDoors: int,
            seats: int,
            emissionGroup: one of Euro 1, Euro 2, Euro 3, Euro 4, Euro 5, Euro 6,
            drivetrain: 2WD, 4WD, AWD, FWD, RWD or 4x4,
            engineSize: float,
            bodyType: one of [Supersport, Sport touring, Chopper/Cruiser, Touring Enduro, Streetfighter, Enduro Bike, Motocrosser, Sidecar, Classic, Three Wheeler, Scooter, Moped, Super Moto, Minibike, Naked Bike, Quad, Rally, Trials Bike, Racing, Tourer, Others] 
        }. `;
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: bigint;
        make: string | null;
        model: string | null;
        cleanedCaption: string | null;
        contact: string | null;
      }>
    >(
      `
      SELECT cd.id, cd.make, cd.model, p.cleanedCaption, cd.contact, cd.bodyType, cd.drivetrain, cd.numberOfDoors, cd.seats
      FROM post p
      LEFT JOIN car_detail cd ON p.id = cd.post_id
      WHERE cd.deleted = 0
        AND cd.published = 1
        AND p.deleted = 0
        AND p.live = 1
        AND cd.type = "motorcycle"
        AND p.origin != "manual"
        AND FROM_UNIXTIME(p.createdTime) > DATE_SUB(NOW(), INTERVAL 3 MONTH)
        AND (
          (cd.contact NOT LIKE "%{%" OR cd.contact IS NULL)
          OR (cd.drivetrain IS NULL OR cd.drivetrain = "" OR drivetrain NOT IN ("2WD", "4WD", "AWD", "FWD", "RWD", "4x4"))
          OR ((cd.numberOfDoors IS NULL OR cd.numberOfDoors = "" OR cd.numberOfDoors > 2) AND cd.numberOfDoors != 0)
          OR (cd.seats IS NULL OR cd.seats = "" OR cd.seats > 2)
        )
      `,
    );
    const captions = rows.map(
      (row) => `{
                            id: ${String(row.id)}
                            , make: ${this.toSafeString(row.make)}
                            , model: ${this.toSafeString(row.model)}
                            , contact: ${this.toSafeString(row.contact)}
                            , caption: ${this.toSafeString(row.cleanedCaption)}
                            }`,
    );
    const firstPrompt = this.buildFirstPromptChunk(captions, length);
    return {
      prompt: rows.length
        ? `${prerequisite}Here is another list: ${firstPrompt}`
        : '',
      size: rows.length,
    };
  }

  private buildFirstPromptChunk(captions: string[], maxLength: number): string {
    if (captions.length === 0) return '';
    const prompts: string[] = [];
    let current: string[] = [];
    for (const caption of captions) {
      current.push(caption);
      if (current.join(', ').length > maxLength) {
        current.pop();
        prompts.push(`[${current.join(', ')}]`);
        current = [caption];
      }
    }
    prompts.push(`[${current.join(', ')}]`);
    return this.normalizePromptWhitespace(prompts[0] ?? '[]');
  }

  private normalizePromptWhitespace(input: string): string {
    return input.replace(/\s+/g, ' ').trim();
  }

  private toSafeString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private toSafeNullableString(value: unknown): string | null {
    const text = this.toSafeString(value);
    return text || null;
  }

  private toSafeNullableNumericString(value: unknown): string | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? String(value) : null;
    }
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return this.toSafeNullableString(value);
  }

  private toNullableInt(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Math.trunc(number);
  }

  private toNullableFloat(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return number;
  }

  private booleanFrom(value: unknown, fallback = false): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const lowered = value.toLowerCase();
      if (['1', 'true', 'yes'].includes(lowered)) return true;
      if (['0', 'false', 'no'].includes(lowered)) return false;
    }
    return fallback;
  }

  private nullableBooleanFrom(value: unknown): boolean | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const lowered = value.toLowerCase();
      if (['1', 'true', 'yes'].includes(lowered)) return true;
      if (['0', 'false', 'no'].includes(lowered)) return false;
    }
    return null;
  }

  private resolveCustomsPaid(result: Record<string, unknown>): boolean | null {
    const caption =
      this.toSafeNullableString(result.caption) ??
      this.toSafeNullableString(result.cleanedCaption);
    const inferred = isCustomsPaid(caption);
    if (Object.prototype.hasOwnProperty.call(result, 'customsPaid')) {
      const explicit = this.nullableBooleanFrom(result.customsPaid);
      if (explicit === true) {
        return true;
      }
      if (explicit === false) {
        // If payload sends false but caption has no customs signal, treat as unknown.
        return inferred === null ? null : false;
      }
      return inferred;
    }
    return inferred;
  }

  private toNullableBigInt(value: unknown): bigint | null {
    const asTimestampSeconds = this.toUnixSeconds(value);
    if (asTimestampSeconds === null) return null;
    try {
      return BigInt(asTimestampSeconds);
    } catch {
      return null;
    }
  }

  private toUnixSeconds(value: unknown): number | null {
    if (value === null || value === undefined) return null;

    if (typeof value === 'bigint') {
      const asNumber = Number(value);
      if (!Number.isFinite(asNumber)) return null;
      return this.normalizeEpochSeconds(asNumber);
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return null;
      return this.normalizeEpochSeconds(value);
    }

    const text = this.toSafeString(value);
    if (!text) return null;

    // Numeric string (seconds/ms)
    if (/^\d+(\.\d+)?$/.test(text)) {
      const parsed = Number(text);
      if (!Number.isFinite(parsed)) return null;
      return this.normalizeEpochSeconds(parsed);
    }

    // ISO date string or any Date.parse-compatible string
    const parsedMs = Date.parse(text);
    if (!Number.isFinite(parsedMs)) return null;
    return this.normalizeEpochSeconds(parsedMs);
  }

  private normalizeEpochSeconds(value: number): number | null {
    if (!Number.isFinite(value) || value <= 0) return null;

    // Treat large epochs as milliseconds and normalize to seconds.
    const seconds = value > 1e12 ? Math.trunc(value / 1000) : Math.trunc(value);
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    return seconds;
  }

  private normalizeBigInts<T>(input: T): T {
    return JSON.parse(
      JSON.stringify(input, (key, value) => {
        if (typeof value === 'bigint') return value.toString();
        if (key === 'caption' && typeof value === 'string') {
          return decodeCaption(value);
        }
        return value;
      }),
    ) as T;
  }
}
