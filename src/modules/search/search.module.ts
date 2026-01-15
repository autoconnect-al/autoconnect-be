import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { PrismaService } from '../../database/prisma.service';
import { MostWantedService } from './most-wanted.service';
import { SearchPostService } from './search-post.service';
import { SearchPostController } from './search-post.controller';
import { MakeModelController } from './make-model.controller';

@Module({
  controllers: [SearchController, SearchPostController, MakeModelController],
  providers: [
    SearchService,
    PrismaService,
    MostWantedService,
    SearchPostService,
  ],
})
export class SearchModule {}
