import { Module } from '@nestjs/common';
import { LegacyFavouritesController } from './legacy-favourites.controller';
import { LegacyFavouritesService } from './legacy-favourites.service';

@Module({
  controllers: [LegacyFavouritesController],
  providers: [LegacyFavouritesService],
})
export class LegacyFavouritesModule {}
