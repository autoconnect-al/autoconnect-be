import { Injectable } from '@nestjs/common';
import { legacySuccess } from '../../common/legacy-response';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class LegacyFavouritesService {
  constructor(private readonly prisma: PrismaService) {}

  private parseIds(value?: string): string[] {
    return (value ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => /^\d+$/.test(id));
  }

  async checkFavourites(favourites?: string) {
    const ids = this.parseIds(favourites);
    if (ids.length === 0) {
      return legacySuccess([]);
    }
    const rows = await this.prisma.search.findMany({
      where: {
        id: { in: ids.map((id) => BigInt(id)) },
        deleted: '0',
        sold: false,
      },
      select: { id: true },
    });
    return legacySuccess(rows.map((row) => row.id.toString()));
  }

  async getFavourites(favourites?: string) {
    const ids = this.parseIds(favourites);
    if (ids.length === 0) {
      return legacySuccess([]);
    }
    const rows = await this.prisma.search.findMany({
      where: {
        id: { in: ids.map((id) => BigInt(id)) },
        deleted: '0',
        sold: false,
      },
    });
    return legacySuccess(this.normalizeBigInts(rows));
  }

  private normalizeBigInts<T>(input: T): T {
    return JSON.parse(
      JSON.stringify(input, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    ) as T;
  }
}
