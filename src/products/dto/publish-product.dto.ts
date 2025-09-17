import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  IsNumberString,
} from 'class-validator';

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

  @IsNumberString()
  @IsNotEmpty()
  price: number;

  @IsNumberString()
  offerPrice: number;

  @IsString()
  @IsNotEmpty()
  descriptionInArabic: string;

  @IsString()
  @IsNotEmpty()
  descriptionInEnglish: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  shortDesciptionInArabic: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  shortDesciptionInEnglish: string;

  @IsNumberString()
  @IsNotEmpty()
  category: number;
}
