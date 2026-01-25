import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class MakeModelService {
  constructor(private readonly prisma: PrismaService) {}

  /** Fetch all unique makes for a given type (car or motorcycle) */
  async getMakes(type: string = 'car'): Promise<string[]> {
    const result: { Make: string }[] = await this.prisma.$queryRawUnsafe(
      `
      SELECT DISTINCT Make
      FROM car_make_model
      WHERE type = ?
        AND Make IS NOT NULL
      ORDER BY Make ASC
      `,
      type,
    );
    return result.map((r) => r.Make);
  }

  /** Fetch models for a given make and type */
  async getModels(make: string, type: string = 'car'): Promise<string[]> {
    const result: { Model: string }[] = await this.prisma.$queryRawUnsafe(
      `
      SELECT DISTINCT Model
      FROM car_make_model
      WHERE type = ?
        AND Make = ?
        AND Model IS NOT NULL
      ORDER BY Model ASC
      `,
      type,
      make,
    );
    return result.map((r) => r.Model);
  }
}
