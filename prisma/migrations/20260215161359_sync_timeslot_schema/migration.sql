/*
  Warnings:

  - You are about to drop the `AvailableDate` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[doctorId,date,time]` on the table `TimeSlot` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `date` to the `TimeSlot` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "AvailableDate" DROP CONSTRAINT "AvailableDate_doctorId_fkey";

-- DropIndex
DROP INDEX "TimeSlot_doctorId_time_key";

-- AlterTable
ALTER TABLE "TimeSlot" ADD COLUMN     "date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "isBooked" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "AvailableDate";

-- CreateIndex
CREATE INDEX "TimeSlot_doctorId_date_idx" ON "TimeSlot"("doctorId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TimeSlot_doctorId_date_time_key" ON "TimeSlot"("doctorId", "date", "time");
