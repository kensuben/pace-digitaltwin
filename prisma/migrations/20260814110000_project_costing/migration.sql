ALTER TABLE "DeviceModel"
  ADD COLUMN "unitPriceVnd" INTEGER,
  ADD COLUMN "priceVatRateBps" INTEGER NOT NULL DEFAULT 800,
  ADD COLUMN "pricingSource" TEXT,
  ADD COLUMN "quotedAt" TIMESTAMP(3);

ALTER TABLE "DeviceModel" ADD CONSTRAINT "DeviceModel_unit_price_nonnegative"
  CHECK ("unitPriceVnd" IS NULL OR "unitPriceVnd" >= 0);
ALTER TABLE "DeviceModel" ADD CONSTRAINT "DeviceModel_price_vat_rate_range"
  CHECK ("priceVatRateBps" >= 0 AND "priceVatRateBps" <= 10000);

CREATE TYPE "ProjectCostCategory" AS ENUM (
  'SOFTWARE', 'OPTICS', 'CABLING', 'RACK', 'ACCESSORY', 'SERVICE', 'OTHER'
);

CREATE TABLE "ProjectCostItem" (
  "id" TEXT NOT NULL,
  "scenarioId" TEXT NOT NULL,
  "category" "ProjectCostCategory" NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitCostVnd" INTEGER NOT NULL,
  "vatRateBps" INTEGER NOT NULL DEFAULT 800,
  "source" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectCostItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectCostItem_quantity_positive" CHECK ("quantity" > 0),
  CONSTRAINT "ProjectCostItem_unit_cost_nonnegative" CHECK ("unitCostVnd" >= 0),
  CONSTRAINT "ProjectCostItem_vat_rate_range" CHECK ("vatRateBps" >= 0 AND "vatRateBps" <= 10000)
);

CREATE UNIQUE INDEX "ProjectCostItem_scenarioId_code_key" ON "ProjectCostItem"("scenarioId", "code");
CREATE INDEX "ProjectCostItem_scenarioId_category_idx" ON "ProjectCostItem"("scenarioId", "category");
ALTER TABLE "ProjectCostItem" ADD CONSTRAINT "ProjectCostItem_scenarioId_fkey"
  FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
