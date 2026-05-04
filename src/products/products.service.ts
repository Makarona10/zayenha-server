import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CategoriesService } from 'src/categories/categories.service';
import { SearchProductsDto } from './dto/search-products.dto';
import { ProductAdd } from './dto/publish-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly categoryService: CategoriesService,
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
    return this.prismaService.$transaction(async (tx) => {
      const merchant = await tx.merchant.findUnique({
        where: { id: userId },
      });
      if (!merchant)
        throw new BadRequestException('Merchant account not found');

      const category = await tx.category.findUnique({
        where: { id: productData.categories[0] },
      });
      if (!category)
        throw new BadRequestException('Primary category not found');

      if (productData.materialId) {
        const material = await tx.material.findUnique({
          where: { id: productData.materialId },
        });
        if (!material) throw new BadRequestException('Material not found');
      }

      const product = await tx.product.create({
        data: {
          merchantId: merchant.id,
          categoryId: productData.categories[0],
          price: new Prisma.Decimal(productData.price),
          offerPrice: productData.offerPrice
            ? new Prisma.Decimal(productData.offerPrice)
            : null,
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

      if (productData.attributes && productData.attributes.length > 0) {
        const attributeData = [];
        productData.attributes.forEach((attr) => {
          attributeData.push({
            productId: product.id,
            name: attr.nameInEnglish,
            value: attr.valueInEnglish,
            languageCode: 'en',
          });
          attributeData.push({
            productId: product.id,
            name: attr.nameInArabic,
            value: attr.valueInArabic,
            languageCode: 'ar',
          });
        });

        await tx.productAttribute.createMany({ data: attributeData });
      }

      if (secondaryImagePaths && secondaryImagePaths.length > 0) {
        await tx.productImage.createMany({
          data: secondaryImagePaths.map((path) => ({
            productId: product.id,
            image: path,
          })),
        });
      }

      if (productData.categories && productData.categories.length > 0) {
        await tx.productCategory.createMany({
          data: productData.categories.map((catId) => ({
            productId: product.id,
            categoryId: catId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.product.findUnique({
        where: { id: product.id },
        include: {
          translations: true,
          images: true,
          material: true,
          categories: { include: { category: true } },
          ProductAttributes: true,
        },
      });
    });
  }

  async getProducts() {
    return this.prismaService.product.findMany();
  }

  private readonly relatedProductInclude = (lang: string) => ({
    translations: {
      where: { languageCode: lang },
    },
    images: {
      take: 1,
      orderBy: { id: 'asc' as const },
    },
    material: {
      include: {
        MeterialTranslation: {
          where: { languageCode: lang },
        },
      },
    },
    category: {
      include: {
        CategoryTranslation: {
          where: { languageCode: lang },
        },
      },
    },
  });

  async getRelatedProducts(productId: number, lang: string = 'en') {
    const currentProduct = await this.prismaService.product.findUnique({
      where: {
        id: productId,
        status: 'approved',
        stockQuantity: { gt: 0 },
        merchant: { status: 'approved' },
      },
      select: { id: true, price: true, categoryId: true, merchantId: true },
    });

    if (!currentProduct) throw new NotFoundException('Product not found');

    const priceMin = Number(currentProduct.price) * 0.8;
    const priceMax = Number(currentProduct.price) * 1.2;

    const [newProducts, bestSellers, sameCategory, sameMerchant] =
      await Promise.all([
        this.getNewProducts(productId, priceMin, priceMax, 3, lang),
        this.getBestSellers(productId, priceMin, priceMax, 3, lang),
        this.getSameCategory(productId, currentProduct.categoryId, 3, lang),
        this.getSameMerchant(productId, currentProduct.merchantId, 3, lang),
      ]);

    const allProducts = [
      ...newProducts,
      ...bestSellers,
      ...sameCategory,
      ...sameMerchant,
    ];
    let uniqueProducts = this.removeDuplicates(allProducts);

    if (uniqueProducts.length < 12) {
      const needed = 12 - uniqueProducts.length;
      const existingIds = uniqueProducts.map((p) => p.id);
      const filler = await this.getFillerProducts(
        productId,
        existingIds,
        needed,
        lang,
      );
      uniqueProducts = [...uniqueProducts, ...filler];
    }

    return uniqueProducts.slice(0, 12);
  }

  private async getNewProducts(
    excludeId: number,
    min: number,
    max: number,
    limit: number,
    lang: string,
  ) {
    return this.prismaService.product.findMany({
      where: {
        id: { not: excludeId },
        status: 'approved',
        stockQuantity: { gt: 0 },
        price: { gte: min, lte: max },
      },
      include: this.relatedProductInclude(lang),
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private async getBestSellers(
    excludeId: number,
    min: number,
    max: number,
    limit: number,
    lang: string,
  ) {
    return this.prismaService.product.findMany({
      where: {
        id: { not: excludeId },
        status: 'approved',
        stockQuantity: { gt: 0 },
        price: { gte: min, lte: max },
      },
      include: {
        ...this.relatedProductInclude(lang),
        _count: { select: { orderItems: true } },
      },
      orderBy: { orderItems: { _count: 'desc' } },
      take: limit,
    });
  }

  private async getSameCategory(
    excludeId: number,
    categoryId: number | null,
    limit: number,
    lang: string,
  ) {
    if (!categoryId) return [];
    return this.prismaService.product.findMany({
      where: {
        id: { not: excludeId },
        status: 'approved',
        stockQuantity: { gt: 0 },
        OR: [{ categoryId }, { categories: { some: { categoryId } } }],
      },
      include: this.relatedProductInclude(lang),
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private async getSameMerchant(
    excludeId: number,
    merchantId: number,
    limit: number,
    lang: string,
  ) {
    return this.prismaService.product.findMany({
      where: {
        id: { not: excludeId },
        merchantId,
        status: 'approved',
        stockQuantity: { gt: 0 },
      },
      include: this.relatedProductInclude(lang),
      orderBy: { orderItems: { _count: 'desc' } },
      take: limit,
    });
  }

  private async getFillerProducts(
    excludeId: number,
    excludeIds: number[],
    limit: number,
    lang: string,
  ) {
    return this.prismaService.product.findMany({
      where: {
        id: { notIn: [excludeId, ...excludeIds] },
        status: 'approved',
        stockQuantity: { gt: 0 },
      },
      include: this.relatedProductInclude(lang),
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private removeDuplicates(products: any[]) {
    const seen = new Set();
    return products.filter((p) => {
      const duplicate = seen.has(p.id);
      seen.add(p.id);
      return !duplicate;
    });
  }

  async getProduct(id: number, languageCode: string = 'en', userId?: number) {
    const product = await this.prismaService.product.findUnique({
      where: {
        id,
        status: 'approved',
        merchant: { status: 'approved' },
      },
      select: {
        id: true,
        price: true,
        offerPrice: true,
        mainImage: true,
        sku: true,
        stockQuantity: true,
        translations: {
          where: { languageCode },
          select: { name: true, shortDescription: true, description: true },
          take: 1,
        },
        images: { select: { image: true } },
        categories: {
          select: {
            category: {
              select: {
                id: true,
                CategoryTranslation: {
                  where: { languageCode },
                  select: { name: true },
                  take: 1,
                },
              },
            },
          },
        },
        ProductAttributes: {
          where: { languageCode },
          select: { name: true, value: true },
        },
        wishlistedBy: userId
          ? {
              where: { userId },
              select: { userId: true },
              take: 1,
            }
          : false,
      },
    });

    if (!product) return null;

    return this.transformProductResponse(product);
  }

  private transformProductResponse(product: any) {
    const translation = product.translations[0] || {};

    return {
      id: product.id,
      sku: product.sku,
      price: Number(product.price),
      offerPrice: product.offerPrice ? Number(product.offerPrice) : null,
      mainImage: product.mainImage,
      stockQuantity: product.stockQuantity,
      name: translation.name || 'Untitled Product',
      description: translation.description || '',
      shortDescription: translation.shortDescription || '',
      images: product.images.map((img: any) => img.image),
      attributes: product.ProductAttributes,
      categories: product.categories.map((c: any) => ({
        id: c.category.id,
        name: c.category.CategoryTranslation[0]?.name || 'Uncategorized',
      })),
      isWishlisted: !!product.wishlistedBy?.length,
    };
  }

  async searchProducts(
    searchDto: SearchProductsDto,
    userId: number,
    lang: string = 'en',
  ) {
    const {
      query,
      categoryId,
      materialId,
      minPrice,
      maxPrice,
      inStock,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = searchDto;

    const where: Prisma.ProductWhereInput = {
      status: 'approved',
      merchant: { status: 'approved' },
    };

    if (query) {
      where.translations = {
        some: {
          languageCode: lang,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { shortDescription: { contains: query, mode: 'insensitive' } },
          ],
        },
      };
    }

    if (categoryId) where.categoryId = categoryId;
    if (materialId) where.materialId = materialId;
    if (inStock) where.stockQuantity = { gt: 0 };

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.AND = [
        {
          OR: [
            {
              offerPrice: {
                not: null,
                ...(minPrice && { gte: new Prisma.Decimal(minPrice) }),
                ...(maxPrice && { lte: new Prisma.Decimal(maxPrice) }),
              },
            },
            {
              AND: [
                { offerPrice: null },
                {
                  price: {
                    ...(minPrice && { gte: new Prisma.Decimal(minPrice) }),
                    ...(maxPrice && { lte: new Prisma.Decimal(maxPrice) }),
                  },
                },
              ],
            },
          ],
        },
      ];
    }

    let orderBy: Prisma.ProductOrderByWithRelationInput = {};
    switch (sortBy) {
      case 'price':
        orderBy = { price: sortOrder };
        break;
      case 'createdAt':
      default:
        orderBy = { createdAt: sortOrder };
        break;
    }

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      this.prismaService.product.findMany({
        where,
        include: {
          translations: { where: { languageCode: lang } },
          images: {
            take: 1,
            orderBy: { id: 'asc' },
          },
          material: {
            include: {
              MeterialTranslation: { where: { languageCode: lang } },
            },
          },
          category: {
            include: {
              CategoryTranslation: { where: { languageCode: lang } },
            },
          },
          ...(userId && {
            wishlistedBy: {
              where: { userId },
              select: { userId: true },
            },
          }),
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prismaService.product.count({ where }),
    ]);

    const formattedData = products.map((product) => ({
      ...product,
      isWishlisted: !!(userId && product.wishlistedBy?.length > 0),
      name: product.translations[0]?.name || '',
      description: product.translations[0]?.description || '',
      categoryName: product.category?.CategoryTranslation[0]?.name || '',
      materialName: product.material?.MeterialTranslation[0]?.name || '',
      wishlistedBy: undefined,
      translations: undefined,
    }));

    return {
      data: formattedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
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
      throw new NotFoundException('Category not found');
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

    const total = await this.prismaService.product.count({
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
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateOfferPrice(id: number, merchantId: number, offerPrice: number) {
    const product = await this.prismaService.product.findUnique({
      where: {
        id,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (product.merchantId !== merchantId) {
      throw new ForbiddenException(
        'You are not authorized to update this product',
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
      throw new NotFoundException('Product not found');
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
      throw new NotFoundException('Product not found');
    }
    return product;
  }
}
