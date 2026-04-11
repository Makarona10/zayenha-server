import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProductAdd } from './types';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private readonly prismaService: PrismaService) {}

  private generateSKU(): string {
    return `SKU-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  //TODO: TO BE IMPLEMENTED AFTER CREATING FEATURED PRODUCTS TABLE
  async getHomePageProducts() {
    try {
      const featured = await this.prismaService.product.findMany({
        where: {
          id: {
            in: [],
          },
        },
      });
    } catch (error) {}
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
      where: { id: productId },
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
        // status: 'approved',
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
        // status: 'approved',
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
        //  status: 'approved'
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
}
