import { IsString, IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class MaterialTranslationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  languageCode: 'en' | 'ar';
}

export class CreateMaterialDto {
  @ValidateNested({ each: true })
  @Type(() => MaterialTranslationDto)
  translations: MaterialTranslationDto[];
}
