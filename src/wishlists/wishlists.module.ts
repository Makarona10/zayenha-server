import { Module } from '@nestjs/common';
import { WishlistsService } from './wishlists.service';

@Module({
  providers: [WishlistsService]
})
export class WishlistsModule {}
