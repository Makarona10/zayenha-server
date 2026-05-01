import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prismaService: PrismaService) {}

  async listCategories() {
    return this.prismaService.category.findMany();
  }

  async insertCategory(category: CategoryDto) {
    const { image, parentCategoryId, translations } = category;

    return this.prismaService.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          image,
          CategoryTranslation: {
            create: translations.map((t) => ({
              name: t.name,
              languageCode: t.languageCode,
            })),
          },
        },
      });

      if (parentCategoryId) {
        await tx.categoryParent.create({
          data: {
            parentId: parentCategoryId,
            childId: category.id,
          },
        });
      }

      return category;
    });
  }

  async getCategoryChildren(categoryId: number) {
    return this.prismaService.category.findMany({
      where: {
        parentLinks: {
          some: {
            parentId: categoryId,
          },
        },
      },
    });
  }

  async categoryExists(categoryId: number): Promise<boolean> {
    const category = await this.prismaService.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });

    return category !== null;
  }
}
