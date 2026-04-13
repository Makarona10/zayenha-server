import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProductAdd } from './types';
import { Prisma } from '@prisma/client';
import { WinstonLogger } from 'src/logger/winston.logger';
import { CategoriesService } from 'src/categories/categories.service';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly categoryService: CategoriesService,
    private readonly winston: WinstonLogger,
  ) {}

  private generateSKU(): string {
    return `SKU-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  //TODO: TO BE IMPLEMENTED AFTER CREATING FEATURED PRODUCTS TABLE
  async getHomePageProducts() {
    const featured = await this.prismaService.product.findMany({
      where: {
        id: {
          in: [],
        },
      },
    });
  }

  async addProductToDB(
    productData: ProductAdd,
    mainImagePath: string,
    secondaryImagePaths: string[],
    userId: number,
  ) {
    return this.prismaService
      .$transaction(async (tx) => {
        const merchant = await tx.merchant.findUnique({
          where: { id: userId },
        });
        if (!merchant) {
          throw new HttpException(
            'Merchant account not found',
            HttpStatus.BAD_REQUEST,
          );
        }

        const category = await tx.category.findUnique({
          where: { id: productData.categories[0] },
        });
        if (!category) {
          throw new HttpException('Category not found', HttpStatus.BAD_REQUEST);
        }

        if (productData.materialId) {
          const material = await tx.material.findUnique({
            where: { id: productData.materialId },
          });
          if (!material) {
            throw new HttpException(
              'Material not found',
              HttpStatus.BAD_REQUEST,
            );
          }
        }

        const product = await tx.product.create({
          data: {
            merchantId: merchant.id,
            categoryId: productData.categories[0],
            price: new Prisma.Decimal(productData.price),
            offerPrice: productData.offerPrice
              ? new Prisma.Decimal(productData.offerPrice)
              : undefined,
            stockQuantity: productData.stockQuantity,
            mainImage: mainImagePath,
            sku: this.generateSKU(),
            status: 'pending',
            materialId: productData.materialId ?? null,
          },
        });

        await tx.productTranslation.createMany({
          data: [
            {
              productId: product.id,
              languageCode: 'ar',
              name: productData.nameInArabic,
              shortDescription: productData.shortDescriptionInArabic,
              description: productData.descriptionInArabic,
            },
            {
              productId: product.id,
              languageCode: 'en',
              name: productData.nameInEnglish,
              shortDescription: productData.shortDescriptionInEnglish,
              description: productData.descriptionInEnglish,
            },
          ],
        });

        if (
          typeof productData.attributes !== 'undefined' &&
          productData.attributes.length > 0
        )
          await tx.productAttribute.createMany({
            data: productData.attributes.map((attr) => ({
              productId: product.id,
              nameInArabic: attr.nameInArabic,
              nameInEnglish: attr.nameInEnglish,
              valueInArabic: attr.valueInArabic,
              valueInEnglish: attr.valueInEnglish,
            })),
          });

        if (secondaryImagePaths && secondaryImagePaths.length > 0) {
          const imagesData = secondaryImagePaths.map((p) => ({
            productId: product.id,
            image: p,
          }));
          await tx.productImage.createMany({ data: imagesData });
        }

        await tx.productCategory.create({
          data: {
            productId: product.id,
            categoryId: productData.categories[0],
          },
        });

        const created = await tx.product.findUnique({
          where: { id: product.id },
          include: {
            translations: true,
            images: true,
            material: true,
            categories: { include: { category: true } },
          },
        });

        return created;
      })
      .catch((err) => {
        throw err;
      });
  }

  //For testing
  async getProducts() {
    return this.prismaService.product.findMany();
  }

  async getRelatedProducts(productId: number) {
    const currentProduct = await this.prismaService.product.findUnique({
      where: {
        id: productId,
        status: 'approved',
        stockQuantity: { gt: 0 },
        merchant: {
          status: 'approved',
        },
      },
      select: {
        id: true,
        price: true,
        categoryId: true,
        merchantId: true,
      },
    });

    if (!currentProduct) {
      throw new NotFoundException('Product not found');
    }

    const priceMin = +currentProduct.price * 0.8;
    const priceMax = +currentProduct.price * 1.2;

    const [newProducts, bestSellers, sameCategory, sameMerchant] =
      await Promise.all([
        this.getNewProducts(productId, priceMin, priceMax, 3),
        this.getBestSellers(productId, priceMin, priceMax, 3),
        this.getSameCategory(productId, currentProduct.categoryId, 3),
        this.getSameMerchant(productId, currentProduct.merchantId, 3),
      ]);

    const allProducts = [
      ...newProducts,
      ...bestSellers,
      ...sameCategory,
      ...sameMerchant,
    ];

    const uniqueProducts = this.removeDuplicates(allProducts);

    if (uniqueProducts.length < 12) {
      const needed = 12 - uniqueProducts.length;
      const existingIds = uniqueProducts.map((p) => p.id);

      const fillerProducts = await this.getFillerProducts(
        productId,
        existingIds,
        needed,
      );

      uniqueProducts.push(...fillerProducts);
    }

    return uniqueProducts.slice(0, 12);
  }

  private async getNewProducts(
    excludeProductId: number,
    priceMin: number,
    priceMax: number,
    limit: number,
  ) {
    return this.prismaService.product.findMany({
      where: {
        id: { not: excludeProductId },
        status: 'approved',
        stockQuantity: { gt: 0 },
        OR: [
          { price: { gte: priceMin, lte: priceMax } },
          { offerPrice: { gte: priceMin, lte: priceMax } },
        ],
      },
      include: {
        translations: true,
        images: {
          take: 1,
          orderBy: { id: 'asc' },
        },
        material: {
          select: {
            id: true,
            nameInEnglish: true,
            nameInArabic: true,
          },
        },
        category: {
          select: {
            id: true,
            nameInEnglish: true,
            nameInArabic: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }

  private async getBestSellers(
    excludeProductId: number,
    priceMin: number,
    priceMax: number,
    limit: number,
  ) {
    return this.prismaService.product.findMany({
      where: {
        id: { not: excludeProductId },
        // status: 'approved',
        stockQuantity: { gt: 0 },
        price: { gte: priceMin, lte: priceMax },
      },
      include: {
        translations: true,
        images: {
          take: 1,
          orderBy: { id: 'asc' },
        },
        material: {
          select: {
            id: true,
            nameInEnglish: true,
            nameInArabic: true,
          },
        },
        category: {
          select: {
            id: true,
            nameInEnglish: true,
            nameInArabic: true,
          },
        },
        _count: {
          select: {
            orderItems: true,
          },
        },
      },
      orderBy: {
        orderItems: {
          _count: 'desc',
        },
      },
      take: limit,
    });
  }

  private async getSameCategory(
    excludeProductId: number,
    categoryId: number | null,
    limit: number,
  ) {
    if (!categoryId) {
      return [];
    }

    return this.prismaService.product.findMany({
      where: {
        id: { not: excludeProductId },
        status: 'approved',
        stockQuantity: { gt: 0 },
        OR: [{ categoryId }, { categories: { some: { categoryId } } }],
      },
      include: {
        translations: true,
        images: {
          take: 1,
          orderBy: { id: 'asc' },
        },
        material: {
          select: {
            id: true,
            nameInEnglish: true,
            nameInArabic: true,
          },
        },
        category: {
          select: {
            id: true,
            nameInEnglish: true,
            nameInArabic: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }

  private async getSameMerchant(
    excludeProductId: number,
    merchantId: number,
    limit: number,
  ) {
    return this.prismaService.product.findMany({
      where: {
        id: { not: excludeProductId },
        merchantId,
        // status: 'approved',
        stockQuantity: { gt: 0 },
      },
      include: {
        translations: true,
        images: {
          take: 1,
          orderBy: { id: 'asc' },
        },
        material: {
          select: {
            id: true,
            nameInEnglish: true,
            nameInArabic: true,
          },
        },
        category: {
          select: {
            id: true,
            nameInEnglish: true,
            nameInArabic: true,
          },
        },
      },
      orderBy: {
        orderItems: {
          _count: 'desc',
        },
      },
      take: limit,
    });
  }

  private async getFillerProducts(
    excludeProductId: number,
    excludeIds: number[],
    limit: number,
  ) {
    return this.prismaService.product.findMany({
      where: {
        id: {
          notIn: [excludeProductId, ...excludeIds],
        },
        status: 'approved',
        stockQuantity: { gt: 0 },
      },
      include: {
        translations: true,
        images: {
          take: 1,
          orderBy: { id: 'asc' },
        },
        material: {
          select: {
            id: true,
            nameInEnglish: true,
            nameInArabic: true,
          },
        },
        category: {
          select: {
            id: true,
            nameInEnglish: true,
            nameInArabic: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }

  private removeDuplicates(products: any[]) {
    const seen = new Set<number>();
    return products.filter((product) => {
      if (seen.has(product.id)) {
        return false;
      }
      seen.add(product.id);
      return true;
    });
  }

  async getProduct(id: number) {
    const product = await this.prismaService.product.findUnique({
      where: {
        id,
        status: 'approved',
        merchant: {
          status: 'approved',
        },
      },
      include: {
        translations: true,
        images: true,
        material: true,
        categories: { include: { category: true } },
      },
    });

    return product;
  }

  async getMerchantProduct(id: number, merchantId: number) {
    const product = await this.prismaService.product.findUnique({
      where: {
        id,
        merchantId,
      },
      include: {
        translations: true,
        images: true,
        material: true,
        categories: { include: { category: true } },
        ProductAttributes: true,
      },
    });
    return product;
  }

  async getProductsByCategory(
    id: number,
    sortByDate: 'asc' | 'desc' = 'desc',
    page: number = 1,
    limit: number = 16,
    userId?: number,
  ) {
    const categoryExists = await this.categoryService.categoryExists(id);
    if (!categoryExists) {
      throw new HttpException('Category not found', HttpStatus.NOT_FOUND);
    }
    let products = await this.prismaService.product.findMany({
      where: {
        status: 'approved',
        stockQuantity: { gt: 0 },
        categoryId: id,
      },
      include: {
        images: true,
        wishlistedBy: userId
          ? {
              where: {
                userId,
              },
            }
          : false,
      },
      orderBy: {
        createdAt: sortByDate,
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    const productsCount = await this.prismaService.product.count({
      where: {
        status: 'approved',
        stockQuantity: { gt: 0 },
        categoryId: id,
      },
    });

    products = products.map((product) => {
      return {
        ...product,
        wishlisted: product.wishlistedBy?.length > 0,
      };
    });

    return {
      products,
      productsCount,
    };
  }

  async updateOfferPrice(id: number, merchantId: number, offerPrice: number) {
    const product = await this.prismaService.product.findUnique({
      where: {
        id,
      },
    });

    if (!product) {
      throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
    }
    if (product.merchantId !== merchantId) {
      throw new HttpException(
        'You are not authorized to update this product',
        HttpStatus.FORBIDDEN,
      );
    }
    return this.prismaService.product.update({
      where: {
        id,
      },
      data: {
        offerPrice,
        updatedAt: new Date(),
      },
    });
  }

  async updateQuantity(id: number, merchantId: number, quantity: number) {
    const product = await this.prismaService.product.update({
      where: {
        id,
        merchantId,
      },
      data: {
        stockQuantity: quantity,
        updatedAt: new Date(),
      },
    });

    if (!product) {
      throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
    }
    return product;
  }

  async suspendProduct(id: number, merchantId: number) {
    const product = await this.prismaService.product.update({
      where: {
        id,
        merchantId,
      },
      data: {
        status: 'suspended',
        updatedAt: new Date(),
      },
    });

    if (!product) {
      throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
    }
    return product;
  }
}
