import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  IsOptional,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  IsNumber,
  IsPositive,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ProductAttributeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nameInEnglish: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nameInArabic: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  valueInEnglish: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  valueInArabic: string;
}

export class ProductDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  nameInArabic: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  nameInEnglish: string;

  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  @Type(() => Number)
  price: number;

  @IsInt()
  @IsPositive()
  @Type(() => Number)
  @IsOptional()
  offerPrice?: number;

  @IsString()
  @IsNotEmpty()
  descriptionInArabic: string;

  @IsString()
  @IsNotEmpty()
  descriptionInEnglish: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  shortDescriptionInArabic: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  shortDescriptionInEnglish: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(50)
  sku: string;

  @IsInt()
  @Min(0)
  @IsNotEmpty()
  @Type(() => Number)
  stockQuantity: number;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  materialId?: number;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return [];
    if (typeof value === 'string') return JSON.parse(value);
    return value;
  })
  categories: number[];

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => ProductAttributeDto)
  @Transform(({ value }) => {
    if (!value) return [];
    if (typeof value === 'string') return JSON.parse(value);
    return value;
  })
  attributes?: ProductAttributeDto[];
}
