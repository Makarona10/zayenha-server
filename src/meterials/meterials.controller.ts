import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { MaterialsService } from './meterials.service';
import { CreateMaterialDto } from './material.dto';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { resObj } from 'src/utils';

@Controller('materials')
export class MeterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Get()
  async getMaterials(@Query('lang') lang: string) {
    const materials = await this.materialsService.findAll(lang || 'en');
    return resObj(200, 'Materials fetched successfully', materials);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async addMaterial(@Body() dto: CreateMaterialDto) {
    return this.materialsService.create(dto);
  }
}
