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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { unlink } from 'fs/promises';
import * as fs from 'fs/promises';
import { CategoryDto } from './dto/category.dto';
import { resObj } from 'src/utils';

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
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: process.env.UPLOADS_PATH + '/categories',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        },
      }),
    }),
  )
  async createCategory(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: CategoryDto,
  ) {
    try {
      if (!file) {
        throw new BadRequestException('Image file is required');
      }
      const insertedCtg = await this.categoriesService.insertCategory({
        ...body,
        image: file.filename,
      });
      return resObj(201, 'Category created successfully', insertedCtg);
    } catch (error) {
      if (
        await fs
          .access(file?.path)
          .then(() => true)
          .catch(() => false)
      )
        await unlink(file?.path);
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
