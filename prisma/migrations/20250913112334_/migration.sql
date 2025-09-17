/*
  Warnings:

  - You are about to drop the column `name` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Material` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[nameInArabic]` on the table `Material` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nameInEnglish]` on the table `Material` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `nameInArabic` to the `Category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nameInEnglish` to the `Category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nameInArabic` to the `Material` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nameInEnglish` to the `Material` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."Material_name_key";

-- DropIndex
DROP INDEX "public"."User_phoneNumber_key";

-- AlterTable
ALTER TABLE "public"."Category" DROP COLUMN "name",
ADD COLUMN     "nameInArabic" VARCHAR(255) NOT NULL,
ADD COLUMN     "nameInEnglish" VARCHAR(255) NOT NULL;

-- AlterTable
ALTER TABLE "public"."Material" DROP COLUMN "name",
ADD COLUMN     "nameInArabic" VARCHAR(100) NOT NULL,
ADD COLUMN     "nameInEnglish" VARCHAR(100) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Material_nameInArabic_key" ON "public"."Material"("nameInArabic");

-- CreateIndex
CREATE UNIQUE INDEX "Material_nameInEnglish_key" ON "public"."Material"("nameInEnglish");
