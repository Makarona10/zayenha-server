/*
  Warnings:

  - A unique constraint covering the columns `[materialId]` on the table `Product` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "materialId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Product_materialId_key" ON "public"."Product"("materialId");

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "public"."Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;
