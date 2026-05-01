import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { MaterialsService } from './meterials.service';
import { CreateMaterialDto } from './material.dto';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('materials')
export class MeterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Get()
  async getMaterials(@Query('lang') lang: string) {
    return this.materialsService.findAll(lang || 'en');
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async addMaterial(@Body() dto: CreateMaterialDto) {
    return this.materialsService.create(dto);
  }
}
