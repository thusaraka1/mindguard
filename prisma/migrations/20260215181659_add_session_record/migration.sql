-- CreateTable
CREATE TABLE "SessionRecord" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "recordedTemp" DOUBLE PRECISION,
    "prescription" TEXT,
    "prediction" TEXT,
    "probability" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION,
    "avgHeartRate" DOUBLE PRECISION,
    "avgBodyTemp" DOUBLE PRECISION,
    "avgSpeechNoise" DOUBLE PRECISION,
    "avgMovement" DOUBLE PRECISION,
    "avgEcgVariability" DOUBLE PRECISION,
    "avgFacialStress" DOUBLE PRECISION,
    "age" INTEGER,
    "gender" TEXT,
    "province" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionRecord_appointmentId_key" ON "SessionRecord"("appointmentId");

-- AddForeignKey
ALTER TABLE "SessionRecord" ADD CONSTRAINT "SessionRecord_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
