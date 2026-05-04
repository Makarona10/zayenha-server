import {
  BadRequestException,
  Body,
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
  UnauthorizedException,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ProductsService } from './products.service';
import { resObj } from 'src/utils';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { removeFilesIfExists } from 'src/utils/fileUtils';
import { Request } from 'express';
import { OptionalJwtAuthGuard } from 'src/auth/guards/optional-jwt-auth.guard';
import { MerchantsService } from 'src/merchants/merchants.service';
import { Payload } from 'src/auth/interfaces/payload.interface';
import { MerchantApprovedGuard } from 'src/auth/guards/merchant-approved.guard';
import { SearchProductsDto } from './dto/search-products.dto';
import { ProductAdd } from './dto/publish-product.dto';
import { FastifyRequest } from 'fastify';

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
  if (!file.mimetype) return cb(new BadRequestException('Invalid file'), false);
  const allowed = /jpeg|jpg|png|webp/;
  const ok = allowed.test(file.mimetype);
  if (ok) cb(null, true);
  else cb(new BadRequestException('Only image files are allowed'), false);
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
  ) {}

  @Get('homepage')
  async getHomePageProducts() {
    throw new NotImplementedException('Under implementation');
  }

  @Post('publish')
  @UseGuards(JwtAuthGuard, MerchantApprovedGuard)
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
    @Req() req: FastifyRequest,
    @Body() productData: ProductAdd,
    @UploadedFiles()
    files: {
      mainImage?: Express.Multer.File[];
      secondaryImages?: Express.Multer.File[];
    },
  ) {
    const user = req.user as { id: number; email?: string; role?: string };

    if (!user || !user.id) {
      cleanupUploadedFiles(files);
      throw new UnauthorizedException('Unauthorized');
    }

    const isMerchantActive = await this.merchantService.isMerchantActive(
      user.id,
    );

    if (!isMerchantActive) {
      cleanupUploadedFiles(files);
      throw new ForbiddenException('Merchant is not active');
    }

    const mainFile = files?.mainImage?.[0];
    if (!mainFile) {
      throw new BadRequestException('Main image is required');
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
