import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ApPromptRepository {
  constructor(private readonly prisma: PrismaService) {}

  findVariantProblematicMakes() {
    return this.prisma.$queryRaw<Array<{ make: string | null }>>(Prisma.raw(`
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
    `));
  }

  findMakeModels(make: string) {
    return this.prisma.$queryRaw<
      Array<{ model: string | null; isVariant: number | boolean | null }>
    >(
      Prisma.sql`SELECT DISTINCT model, isVariant FROM car_make_model WHERE make = ${make} ORDER BY id`,
    );
  }

  findVariantProblemsByMake(make: string) {
    return this.prisma.$queryRaw<
      Array<{
        id: bigint;
        make: string | null;
        model: string | null;
        variant: string | null;
        bodyType: string | null;
        fuelType: string | null;
        engineSize: string | null;
      }>
    >(Prisma.sql`
      SELECT cd.id, cd.make, cd.model, cd.variant, bodyType, fuelType, engineSize
      FROM car_detail cd
      LEFT JOIN post p ON p.id = post_id
      WHERE FROM_UNIXTIME(p.createdTime) > DATE_SUB(NOW(), INTERVAL 3 MONTH)
        AND p.deleted = 0
        AND p.live = 1
        AND cd.deleted = 0
        AND cd.published = 1
        AND cd.sold = 0
        AND cd.make = ${make}
        AND p.vendor_id != 1
        AND (
          (cd.model NOT IN (SELECT REPLACE(cmm.Model, ' (all)', '') FROM car_make_model cmm WHERE cmm.Make = ${make} AND cmm.isVariant = 0) AND cd.model != 'Other')
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
    `);
  }

  findGeneralPromptRows() {
    return this.prisma.$queryRaw<Array<{ id: bigint; cleanedCaption: string | null }>>(
      Prisma.raw(`
        SELECT p.id, p.cleanedCaption
        FROM post p
        LEFT JOIN car_detail cd ON cd.post_id = p.id
        WHERE (cd.published = 0 OR cd.published IS NULL OR p.revalidate = 1)
          AND (cd.sold = 0 OR cd.sold IS NULL)
          AND (cd.deleted = 0 OR cd.deleted IS NULL)
          AND (p.origin = 'manual' OR p.origin = 'instagram')
          AND (p.deleted = 0 OR p.deleted IS NULL)
        ORDER BY p.dateCreated DESC
      `),
    );
  }

  findRegistrationPromptRows() {
    return this.prisma.$queryRaw<
      Array<{
        id: bigint;
        make: string | null;
        model: string | null;
        cleanedCaption: string | null;
        contact: string | null;
      }>
    >(Prisma.raw(`
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
    `));
  }

  findMileagePromptRows() {
    return this.prisma.$queryRaw<
      Array<{
        id: bigint;
        cleanedCaption: string | null;
        make: string | null;
        model: string | null;
        registration: string | number | null;
        fuelType: string | null;
      }>
    >(Prisma.raw(`
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
    `));
  }

  findPricePromptRows() {
    return this.prisma.$queryRaw<
      Array<{
        id: bigint;
        cleanedCaption: string | null;
        make: string | null;
        model: string | null;
        registration: string | number | null;
        fuelType: string | null;
      }>
    >(Prisma.raw(`
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
    `));
  }

  findMotorcyclePromptRows() {
    return this.prisma.$queryRaw<
      Array<{
        id: bigint;
        make: string | null;
        model: string | null;
        cleanedCaption: string | null;
        contact: string | null;
      }>
    >(Prisma.raw(`
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
    `));
  }
}
