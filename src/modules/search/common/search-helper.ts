// src/car-make-model/car-make-model.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class SearchHelper {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Prepares the make/model data from the database and finds the best match.
   * @param make - Car make to search
   * @param model - Car model to search
   * @returns The matched model and isVariant flag, or null if none found
   */
  async prepareMakeModel(
    make: string,
    model: string,
  ): Promise<{ model: string; isVariant: boolean } | null> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    const dbModels = (await this.prisma.car_make_model.findMany({
      where: { Make: make },
      select: { Model: true, isVariant: true },
    })) as { Model: string; isVariant: boolean }[];

    let foundModel: string | null = null;

    const normalize = (str: string) =>
      str?.replace(' (all)', '').replace(/ /g, '-').toLowerCase() ?? '';

    const normalizedModel = normalize(model);

    for (const dbModel of dbModels) {
      const normalizedDbModel = normalize(dbModel.Model);

      // Exact match
      if (normalizedDbModel === normalizedModel) {
        return {
          model: dbModel.Model,
          isVariant: dbModel.isVariant,
        };
      }

      const startsWithModel = normalizedDbModel.startsWith(normalizedModel);
      const startsWithModelReverse =
        normalizedModel.startsWith(normalizedDbModel);

      if (startsWithModel || startsWithModelReverse) {
        if (!foundModel) {
          foundModel = dbModel.Model!;
        }

        const similarity = this.getSimilarity(
          normalizedDbModel,
          normalizedModel,
        );
        const existingSimilarity = this.getSimilarity(
          foundModel,
          normalizedModel,
        );

        if (similarity > existingSimilarity) {
          foundModel = dbModel.Model!;
        }
      }
    }

    if (foundModel) {
      const matchedDbModel = dbModels.find((m) => m.Model === foundModel);
      return matchedDbModel
        ? { model: matchedDbModel.Model, isVariant: matchedDbModel.isVariant }
        : null;
    }

    return null;
  }

  /**
   * Returns the correct Make name from the DB if it exists, otherwise normalizes the input
   * @param make - The input make
   * @returns Corrected Make string
   */
  async getCorrectMake(make: string): Promise<string> {
    // Only fetch makes containing a dash (like '%-%' in SQL)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    const dbMakes = (await this.prisma.car_make_model.findMany({
      where: { Make: { contains: '-' } },
      select: { Make: true },
    })) as { Make: string }[];

    const normalize = (str: string) =>
      str?.replace(/ /g, '-').toLowerCase() ?? '';
    const normalizedInput = normalize(make);

    for (const dbMake of dbMakes) {
      if (normalize(dbMake.Make) === normalizedInput) {
        return dbMake.Make;
      }
    }

    // Fallback: replace dashes with spaces
    return make.replace(/-/g, ' ');
  }

  /**
   * Computes a similarity score between two strings (0-100)
   * Simple character-based approach similar to PHP's similar_text
   */
  private getSimilarity(a: string, b: string): number {
    let matches = 0;
    const minLength = Math.min(a.length, b.length);

    for (let i = 0; i < minLength; i++) {
      if (a[i] === b[i]) matches++;
    }

    return (matches / Math.max(a.length, b.length)) * 100;
  }
}
