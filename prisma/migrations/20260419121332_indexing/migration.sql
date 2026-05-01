/*
  Warnings:

  - The primary key for the `CategoryTranslation` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `address` to the `Address` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."Product_merchantId_idx";

-- AlterTable
ALTER TABLE "public"."Address" ADD COLUMN     "address" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."CategoryTranslation" DROP CONSTRAINT "CategoryTranslation_pkey",
ADD CONSTRAINT "CategoryTranslation_pkey" PRIMARY KEY ("name", "languageCode");

-- CreateIndex
CREATE INDEX "CategoryTranslation_languageCode_name_idx" ON "public"."CategoryTranslation"("languageCode", "name");

-- CreateIndex
CREATE INDEX "Merchant_status_idx" ON "public"."Merchant"("status");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "public"."Product"("status");

-- CreateIndex
CREATE INDEX "ProductTranslation_name_idx" ON "public"."ProductTranslation"("name");
