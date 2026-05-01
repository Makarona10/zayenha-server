import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateMaterialDto } from './material.dto';

@Injectable()
export class MaterialsService {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll(lang: string = 'en') {
    return this.prismaService.material.findMany({
      select: {
        id: true,
        MeterialTranslation: {
          where: { languageCode: lang },
          select: { name: true },
        },
      },
    });
  }

  async serchMaterial(name: string, lang: string = 'en') {
    return this.prismaService.material.findMany({
      where: {
        MeterialTranslation: {
          some: {
            name: {
              contains: name,
            },
            languageCode: lang,
          },
        },
      },
      select: {
        id: true,
        MeterialTranslation: {
          where: { languageCode: lang },
          select: { name: true },
        },
      },
    });
  }

  async create(dto: CreateMaterialDto) {
    return this.prismaService.material.create({
      data: {
        MeterialTranslation: {
          create: dto.translations.map((t) => ({
            name: t.name,
            languageCode: t.languageCode,
          })),
        },
      },
    });
  }
}
