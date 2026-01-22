import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { PrismaService } from '../../database/prisma.service';
import { MostWantedService } from './most-wanted/most-wanted.service';
import { SearchPostService } from './search-posts/search-post.service';
import { SearchPostController } from './search-posts/search-post.controller';
import { MakeModelController } from './makes-models/make-model.controller';
import { RelatedPostsController } from './related-posts/related-posts.controller';
import { RelatedPostsService } from './related-posts/related-posts.service';
import { SearchHelper } from './common/search-helper';
import { MakeModelService } from './makes-models/make-model.service';

@Module({
  controllers: [
    SearchController,
    SearchPostController,
    MakeModelController,
    RelatedPostsController,
  ],
  providers: [
    SearchService,
    PrismaService,
    MostWantedService,
    SearchPostService,
    RelatedPostsService,
    SearchHelper,
    MakeModelService,
  ],
})
export class SearchModule {}
