/*
  Warnings:

  - You are about to drop the column `address` on the `Address` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Order" DROP CONSTRAINT "Order_addressId_fkey";

-- AlterTable
ALTER TABLE "public"."Address" DROP COLUMN "address";
