import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  NotImplementedException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ProductsService } from './products.service';
import { resObj } from 'src/utils';
import { extname, join } from 'path';
import * as fs from 'fs/promises';
import { removeFilesIfExists } from 'src/utils/fileUtils';
import { OptionalJwtAuthGuard } from 'src/auth/guards/optional-jwt-auth.guard';
import { MerchantsService } from 'src/merchants/merchants.service';
import { Payload } from 'src/auth/interfaces/payload.interface';
import { MerchantApprovedGuard } from 'src/auth/guards/merchant-approved.guard';
import { SearchProductsDto } from './dto/search-products.dto';
import { ProductAdd } from './dto/publish-product.dto';
import { FastifyRequest } from 'fastify';
import { pipeline } from 'stream/promises';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { createWriteStream } from 'fs';
import { ConfigService } from '@nestjs/config';

const UPLOAD_DIR = '../uploads/products/';

function filenameFactory(originalName: string) {
  const random = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const ext = extname(originalName) || '.jpg';
  return `${random}${ext}`;
}

function cleanupUploadedFiles(files: {
  mainImage?: Express.Multer.File[];
  secondaryImages?: Express.Multer.File[];
}) {
  const paths: string[] = [];
  if (files?.mainImage?.[0]) paths.push(files.mainImage[0].path);
  if (files?.secondaryImages) {
    paths.push(...files.secondaryImages.map((f) => f.path));
  }
  removeFilesIfExists(paths);
}

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly merchantService: MerchantsService,
    private configService: ConfigService,
  ) {}

  @Get('homepage')
  async getHomePageProducts() {
    throw new NotImplementedException('Under implementation');
  }

  @Post('publish')
  @UseGuards(JwtAuthGuard, MerchantApprovedGuard)
  async publishProduct(@Req() req: FastifyRequest) {
    const user = req.user as { id: number };
    const uploadDir = this.configService.get('UPLOADS_PATH');

    let mainImagePath: string = '';
    const secondaryImagePaths: string[] = [];
    let productData: ProductAdd | null = null;

    try {
      const parts = req.parts();

      for await (const part of parts) {
        if (part.type === 'file') {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const filename = uniqueSuffix + extname(part.filename);
          const savePath = join(uploadDir, 'products', filename);

          if (part.fieldname === 'mainImage') {
            await pipeline(part.file, createWriteStream(savePath));
            mainImagePath = savePath;
          } else if (part.fieldname === 'secondaryImages') {
            await pipeline(part.file, createWriteStream(savePath));
            secondaryImagePaths.push(savePath);
          } else {
            part.file.resume(); // Throw away unknown files
          }
        } else {
          if (part.fieldname === 'data') {
            const rawValue = JSON.parse(part.value as string);
            productData = plainToInstance(ProductAdd, rawValue);

            const errors = await validate(productData);
            if (errors.length > 0) {
              throw new BadRequestException(errors);
            }
          }
        }
      }

      if (!productData)
        throw new BadRequestException('Product data (JSON) is missing');
      if (!mainImagePath)
        throw new BadRequestException('Main image is required');

      const result = await this.productsService.addProductToDB(
        productData,
        mainImagePath,
        secondaryImagePaths,
        user.id,
      );

      return { statusCode: 201, message: 'Product published', data: result };
    } catch (error) {
      const allPaths = [mainImagePath, ...secondaryImagePaths].filter(Boolean);
      for (const path of allPaths) {
        await fs.unlink(path).catch(() => {});
      }

      throw new HttpException(
        error?.response || error?.message || 'Internal Server Error',
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

  @Get('get-product/:id/:lang')
  @UseGuards(OptionalJwtAuthGuard)
  async getProduct(
    @Param(
      'id',
      new ParseIntPipe({ errorHttpStatusCode: HttpStatus.NOT_ACCEPTABLE }),
    )
    id: number,
    @Param('lang') lang: string,
    @Req() req: FastifyRequest,
  ) {
    if (!id) {
      throw new BadRequestException('Product id is required');
    }
    const userId = req.user?.id;
    const product = await this.productsService.getProduct(+id, lang, userId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return resObj(200, 'Product fetched successfully', product);
  }

  @Get('search')
  @UseGuards(OptionalJwtAuthGuard)
  async searchProducts(
    @Query() searchProductsDto: SearchProductsDto,
    @Req() req: FastifyRequest,
  ) {
    const user = req.user as Payload;
    const products = await this.productsService.searchProducts(
      searchProductsDto,
      +user.id,
    );
    return resObj(200, 'Products fetched successfully', products);
  }

  @Get('merchant-product/:id')
  @UseGuards(JwtAuthGuard, MerchantApprovedGuard)
  async getMerchantProduct(
    @Param('id') id: number,
    @Req() req: FastifyRequest,
  ) {
    const user = req.user as Payload;
    if (user.role !== 'merchant') {
      throw new ForbiddenException('You are not allowed to access this route');
    }
    const product = await this.productsService.getMerchantProduct(+id, user.id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return resObj(200, 'Merchant products fetched successfully', product);
  }

  @Get('related-products/:id')
  async getRelatedProducts(
    @Param(
      'id',
      new ParseIntPipe({ errorHttpStatusCode: HttpStatus.NOT_ACCEPTABLE }),
    )
    id: number,
  ) {
    if (!id) {
      throw new BadRequestException('Product id is required');
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
    @Param(
      'id',
      new ParseIntPipe({ errorHttpStatusCode: HttpStatus.NOT_ACCEPTABLE }),
    )
    id: number,
    @Query('sortByDate') sortByDate: 'asc' | 'desc',
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Req() req: FastifyRequest,
  ) {
    if (!id) {
      throw new BadRequestException('Category id is required');
    }

    const user = req.user as Payload;
    const products = await this.productsService.getProductsByCategory(
      +id,
      sortByDate,
      page,
      limit,
      user?.id,
    );
    return resObj(200, 'Products fetched successfully', products);
  }

  @Patch('update-offer/:id')
  @UseGuards(JwtAuthGuard, MerchantApprovedGuard)
  async updateOfferPrice(
    @Param('id') id: number,
    @Query('offerPrice') offerPrice: number,
    @Req() req: FastifyRequest,
  ) {
    if (!id) {
      throw new BadRequestException('Product id is required');
    }
    const user = req.user as { id: number };
    await this.productsService.updateOfferPrice(+id, user.id, offerPrice);
    return resObj(200, 'Product offer price updated successfully');
  }

  @Patch('update-quantity/:id')
  @UseGuards(JwtAuthGuard, MerchantApprovedGuard)
  async updateQuantity(
    @Param(
      'id',
      new ParseIntPipe({ errorHttpStatusCode: HttpStatus.NOT_ACCEPTABLE }),
    )
    id: number,
    @Query(
      'quantity',
      new ParseIntPipe({ errorHttpStatusCode: HttpStatus.NOT_ACCEPTABLE }),
    )
    quantity: number,
    @Req() req: FastifyRequest,
  ) {
    if (!id) {
      throw new BadRequestException('Product id is required');
    }
    const user = req.user as { id: number };
    await this.productsService.updateQuantity(+id, user.id, quantity);
    return resObj(200, 'Product quantity updated successfully');
  }

  @Patch('suspend/:id')
  @UseGuards(JwtAuthGuard, MerchantApprovedGuard)
  async suspendProduct(
    @Param(
      'id',
      new ParseIntPipe({ errorHttpStatusCode: HttpStatus.NOT_ACCEPTABLE }),
    )
    id: number,
    @Req() req: FastifyRequest,
  ) {
    if (!id) {
      throw new BadRequestException('Product id is required');
    }
    const user = req.user as { id: number };
    await this.productsService.suspendProduct(+id, user.id);
    return resObj(200, 'Product suspended successfully');
  }
}
