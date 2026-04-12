import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  NotImplementedException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ProductsService } from './products.service';
import { ProductDto } from './dto/publish-product.dto';
import { resObj } from 'src/utils';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { removeFilesIfExists } from 'src/utils/fileUtils';
import { Request } from 'express';
import { OptionalJwtAuthGuard } from 'src/auth/optional-jwt-auth.guard';

const UPLOAD_DIR = '../uploads/products/';

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function filenameFactory(originalName: string) {
  const random = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const ext = extname(originalName) || '.jpg';
  return `${random}${ext}`;
}

function imageFileFilter(req, file, cb) {
  if (!file.mimetype)
    return cb(new HttpException('Invalid file', HttpStatus.BAD_REQUEST), false);
  const allowed = /jpeg|jpg|png|webp/;
  const ok = allowed.test(file.mimetype);
  if (ok) cb(null, true);
  else
    cb(
      new HttpException('Only image files are allowed', HttpStatus.BAD_REQUEST),
      false,
    );
}

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('homepage')
  async getHomePageProducts() {
    throw new NotImplementedException('Under implementation');
  }

  @Post('publish')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'mainImage', maxCount: 1 },
        { name: 'secondaryImages', maxCount: 5 },
      ],
      {
        storage: diskStorage({
          destination: (req, file, cb) => {
            ensureUploadDir();
            cb(null, UPLOAD_DIR);
          },
          filename: (req, file, cb) => {
            cb(null, filenameFactory(file.originalname));
          },
        }),
        fileFilter: imageFileFilter,
        limits: { fileSize: 5 * 1024 * 1024 },
      },
    ),
  )
  async publishProduct(
    @Req() req: any,
    @Body() productData: ProductDto,
    @UploadedFiles()
    files: {
      mainImage?: Express.Multer.File[];
      secondaryImages?: Express.Multer.File[];
    },
  ) {
    const user = req.user as { id: number; email?: string; role?: string };
    if (!user || !user.id) {
      const uploadedPaths: string[] = [];
      if (files?.mainImage?.[0]) uploadedPaths.push(files.mainImage[0].path);
      if (files?.secondaryImages)
        uploadedPaths.push(...files.secondaryImages.map((f) => f.path));
      removeFilesIfExists(uploadedPaths);

      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const mainFile = files?.mainImage?.[0];
    if (!mainFile) {
      throw new HttpException('Main image is required', HttpStatus.BAD_REQUEST);
    }

    const secondaryFiles = files?.secondaryImages ?? [];

    const mainPath = mainFile.path;
    const secondaryPaths = secondaryFiles.map((f) => f.path);

    try {
      const created = await this.productsService.addProductToDB(
        productData,
        mainPath,
        secondaryPaths,
        user.id,
      );

      return resObj(201, 'Product published successfully', created);
    } catch (error) {
      const uploadedPaths = [mainPath, ...secondaryPaths];
      removeFilesIfExists(uploadedPaths);

      throw new HttpException(
        error?.message || 'Failed to publish product',
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // For testing
  @Get('get-products')
  @UseGuards(OptionalJwtAuthGuard)
  async getProducts() {
    return this.productsService.getProducts();
  }

  @Get('get-product/:id')
  async getProduct(@Param('id') id: number) {
    if (!id) {
      throw new HttpException('Product id is required', HttpStatus.BAD_REQUEST);
    }
    const product = await this.productsService.getProduct(+id);
    if (!product) {
      throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
    }
    return resObj(200, 'Product fetched successfully', product);
  }

  @Get('related-products/:id')
  async getRelatedProducts(@Param('id') id: number) {
    if (!id) {
      throw new HttpException('Product id is required', HttpStatus.BAD_REQUEST);
    }

    const relatedProducts = await this.productsService.getRelatedProducts(+id);

    return resObj(
      200,
      'Related products fetched successfully',
      relatedProducts,
    );
  }

  @Get('category/:id')
  @UseGuards(OptionalJwtAuthGuard)
  async getProductsByCategory(
    @Param('id', ParseIntPipe) id: number,
    @Query('sortByDate') sortByDate: 'asc' | 'desc',
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Req() req: Request,
  ) {
    if (!id) {
      throw new HttpException(
        'Category id is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = req.user as { id: number };
    const products = await this.productsService.getProductsByCategory(
      +id,
      sortByDate,
      page,
      limit,
      user?.id,
    );
    return resObj(200, 'Products fetched successfully', products);
  }
}
