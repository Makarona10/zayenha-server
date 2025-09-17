/*
  Warnings:

  - Added the required column `address` to the `Merchant` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Merchant" ADD COLUMN     "address" VARCHAR(512) NOT NULL;
