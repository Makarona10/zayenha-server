import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prismaService: PrismaService) {}

  async listCategories() {
    return this.prismaService.category.findMany();
  }

  async insertCategory(
    nameInArabic: string,
    nameInEnglish: string,
    image: string,
  ) {
    return this.prismaService.category.create({
      data: {
        nameInArabic,
        nameInEnglish,
        image,
      },
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
