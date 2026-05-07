import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  NotImplementedException,
  Post,
  Req,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { FastifyRequest } from 'fastify';
import { extname, join } from 'path';
import * as fs from 'fs/promises';
import { resObj } from 'src/utils';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { CategoryDto } from './dto/category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async listCategories() {
    const ctgs = await this.categoriesService.listCategories();
    return resObj(200, 'Categories fetched successfully', ctgs);
  }

  //TODO: Auth part comes later after discussing business logic
  @Post('admin/add-category')
  async createCategory(@Req() req: FastifyRequest) {
    const multipartData = await req.file();
    if (!multipartData)
      throw new BadRequestException('No multipart data found');

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const filename = uniqueSuffix + extname(multipartData.filename);
    const savePath = join(process.env.UPLOADS_PATH, 'categories', filename);
    try {
      await pipeline(multipartData.file, createWriteStream(savePath));

      const translationsRaw = (multipartData.fields.translations as any)?.value;

      if (!translationsRaw) {
        throw new BadRequestException(
          'The "translations" field is missing in form-data',
        );
      }

      const translations = JSON.parse(translationsRaw);

      const parentIdRaw = (multipartData.fields.parentCategoryId as any)?.value;

      const insertedCtg = await this.categoriesService.insertCategory({
        translations,
        parentCategoryId: parentIdRaw ? +parentIdRaw : undefined,
        image: filename,
      });
      return resObj(201, 'Category created successfully', insertedCtg);
    } catch (error) {
      if (
        await fs
          .access(savePath)
          .then(() => true)
          .catch(() => false)
      ) {
        await fs.unlink(savePath);
      }
      throw new HttpException(
        error?.message || 'Could not create category',
        error?.status || error?.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('/:id')
  async deleteCategory() {
    throw new NotImplementedException('Method not implemented.');
  }

  @Get('category-childs/:id')
  async getCategoryChilds() {
    throw new NotImplementedException('Method not implemented.');
  }
}
