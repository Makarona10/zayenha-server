import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({})
export class CategoriesModule {
  imports = [];
  controllers = [CategoriesController];
  providers = [CategoriesService];
}
