import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
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
}
