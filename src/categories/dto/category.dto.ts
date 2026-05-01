import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  IsOptional,
  IsInt,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CategoryTranslationDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(5) // Matches @db.VarChar(5)
  languageCode: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255) // Matches @@id([name, languageCode])
  name: string;
}

export class CategoryDto {
  @IsString()
  @IsNotEmpty()
  image: string;

  @IsOptional()
  @IsInt()
  parentCategoryId?: number;

  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CategoryTranslationDto)
  translations: CategoryTranslationDto[];
}
