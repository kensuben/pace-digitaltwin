ALTER TABLE "DeviceInstance"
ADD COLUMN "unitPriceOverrideVnd" INTEGER,
ADD COLUMN "priceVatRateOverrideBps" INTEGER,
ADD COLUMN "pricingSourceOverride" TEXT;

ALTER TABLE "DeviceInstance"
ADD CONSTRAINT "DeviceInstance_unitPriceOverrideVnd_check"
CHECK ("unitPriceOverrideVnd" IS NULL OR "unitPriceOverrideVnd" >= 0),
ADD CONSTRAINT "DeviceInstance_priceVatRateOverrideBps_check"
CHECK ("priceVatRateOverrideBps" IS NULL OR ("priceVatRateOverrideBps" >= 0 AND "priceVatRateOverrideBps" <= 10000));
