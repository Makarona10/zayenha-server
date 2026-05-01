/*
  Warnings:

  - You are about to drop the column `nameInArabic` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `nameInEnglish` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `nameInArabic` on the `Material` table. All the data in the column will be lost.
  - You are about to drop the column `nameInEnglish` on the `Material` table. All the data in the column will be lost.
  - You are about to drop the column `nameInArabic` on the `ProductAttribute` table. All the data in the column will be lost.
  - You are about to drop the column `nameInEnglish` on the `ProductAttribute` table. All the data in the column will be lost.
  - You are about to drop the column `valueInArabic` on the `ProductAttribute` table. All the data in the column will be lost.
  - You are about to drop the column `valueInEnglish` on the `ProductAttribute` table. All the data in the column will be lost.
  - Made the column `city` on table `Address` required. This step will fail if there are existing NULL values in that column.
  - Made the column `district` on table `Address` required. This step will fail if there are existing NULL values in that column.
  - Made the column `street` on table `Address` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `languageCode` to the `ProductAttribute` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `ProductAttribute` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ProductAttribute` table without a default value. This is not possible if the table is not empty.
  - Added the required column `value` to the `ProductAttribute` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."Material_nameInArabic_key";

-- DropIndex
DROP INDEX "public"."Material_nameInEnglish_key";

-- DropIndex
DROP INDEX "public"."ProductAttribute_productId_nameInEnglish_key";

-- AlterTable
ALTER TABLE "public"."Address" ALTER COLUMN "city" SET NOT NULL,
ALTER COLUMN "district" SET NOT NULL,
ALTER COLUMN "street" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."Category" DROP COLUMN "nameInArabic",
DROP COLUMN "nameInEnglish";

-- AlterTable
ALTER TABLE "public"."Material" DROP COLUMN "nameInArabic",
DROP COLUMN "nameInEnglish";

-- AlterTable
ALTER TABLE "public"."Merchant" ADD COLUMN     "businessName" VARCHAR(255) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "public"."ProductAttribute" DROP COLUMN "nameInArabic",
DROP COLUMN "nameInEnglish",
DROP COLUMN "valueInArabic",
DROP COLUMN "valueInEnglish",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "languageCode" VARCHAR(5) NOT NULL,
ADD COLUMN     "name" VARCHAR(255) NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "value" VARCHAR(255) NOT NULL;

-- CreateTable
CREATE TABLE "public"."CategoryTranslation" (
    "categoryId" INTEGER NOT NULL,
    "languageCode" VARCHAR(5) NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "CategoryTranslation_pkey" PRIMARY KEY ("categoryId","languageCode")
);

-- CreateTable
CREATE TABLE "public"."MeterialTranslation" (
    "materialId" INTEGER NOT NULL,
    "languageCode" VARCHAR(5) NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "MeterialTranslation_pkey" PRIMARY KEY ("materialId","languageCode")
);

-- AddForeignKey
ALTER TABLE "public"."CategoryTranslation" ADD CONSTRAINT "CategoryTranslation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MeterialTranslation" ADD CONSTRAINT "MeterialTranslation_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "public"."Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;
