import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CategoryDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(255)
  nameInArabic: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(255)
  nameInEnglish: string;

  parentCategoryId?: number;
}
