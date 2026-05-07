import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsNotEmpty,
  ValidateNested,
  Min,
  IsInt,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProductAttributeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nameInArabic: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nameInEnglish: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  valueInArabic: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  valueInEnglish: string;
}

export class ProductAdd {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nameInArabic: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nameInEnglish: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  shortDescriptionInArabic?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
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
  categories: number[];

  @IsInt()
  @IsOptional()
  materialId?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeDto)
  @IsOptional()
  attributes?: ProductAttributeDto[];
}
