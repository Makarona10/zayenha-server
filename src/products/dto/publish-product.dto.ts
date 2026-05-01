import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsNotEmpty,
  ValidateNested,
  Min,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProductAttributeDto {
  @IsString()
  @IsNotEmpty()
  nameInArabic: string;

  @IsString()
  @IsNotEmpty()
  nameInEnglish: string;

  @IsString()
  @IsNotEmpty()
  valueInArabic: string;

  @IsString()
  @IsNotEmpty()
  valueInEnglish: string;
}

export class ProductAdd {
  @IsString()
  @IsNotEmpty()
  nameInArabic: string;

  @IsString()
  @IsNotEmpty()
  nameInEnglish: string;

  @IsString()
  @IsOptional()
  shortDescriptionInArabic?: string;

  @IsString()
  @IsOptional()
  shortDescriptionInEnglish?: string;

  @IsString()
  @IsOptional()
  descriptionInArabic?: string;

  @IsString()
  @IsOptional()
  descriptionInEnglish?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  offerPrice?: number;

  @IsInt()
  @Min(0)
  stockQuantity: number;

  @IsArray()
  @IsInt({ each: true })
  @IsNotEmpty()
  categories: number[]; // Array of IDs, [0] is the main category

  @IsInt()
  @IsOptional()
  materialId?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeDto)
  @IsOptional()
  attributes?: ProductAttributeDto[];
}
