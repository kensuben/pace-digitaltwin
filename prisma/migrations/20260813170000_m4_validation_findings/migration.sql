CREATE TYPE "ValidationSeverity" AS ENUM ('ERROR', 'WARNING', 'INFO');

CREATE TABLE "ValidationFinding" (
  "id" TEXT NOT NULL,
  "scenarioId" TEXT NOT NULL,
  "severity" "ValidationSeverity" NOT NULL,
  "ruleCode" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "remediation" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ValidationFinding_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ValidationFinding_scenarioId_severity_idx" ON "ValidationFinding"("scenarioId", "severity");
CREATE INDEX "ValidationFinding_scenarioId_ruleCode_idx" ON "ValidationFinding"("scenarioId", "ruleCode");
CREATE INDEX "ValidationFinding_entityType_entityId_idx" ON "ValidationFinding"("entityType", "entityId");

ALTER TABLE "ValidationFinding" ADD CONSTRAINT "ValidationFinding_scenarioId_fkey"
  FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
