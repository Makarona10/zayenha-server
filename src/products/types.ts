export interface ProductAdd {
  nameInArabic: string;
  nameInEnglish: string;
  price: number;
  offerPrice?: number;
  descriptionInArabic: string;
  descriptionInEnglish: string;
  shortDescriptionInArabic: string;
  shortDescriptionInEnglish: string;
  categories?: number[];
  sku: string;
  stockQuantity: number;
  materialId?: number;
  attributes?: Array<{
    nameInEnglish: string;
    nameInArabic: string;
    valueInEnglish: string;
    valueInArabic: string;
  }>;
}
