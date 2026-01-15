import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { PrismaService } from '../../database/prisma.service';
import { MostWantedService } from './most-wanted.service';

@Module({
  controllers: [SearchController],
  providers: [SearchService, PrismaService, MostWantedService],
})
export class SearchModule {}
