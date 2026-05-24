-- CreateTable
CREATE TABLE "PublicHoliday" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'CD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicHoliday_country_date_idx" ON "PublicHoliday"("country", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PublicHoliday_date_country_key" ON "PublicHoliday"("date", "country");
