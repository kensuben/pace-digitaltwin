import { AppShell } from "@/components/app-shell";
import { DesignWizard } from "@/components/wizard/design-wizard";
import { PrismaScenarioRepository } from "@/server/repositories/scenarioRepository";

export const dynamic = "force-dynamic";

export default async function DesignWizardPage() {
  const scenarios = (await new PrismaScenarioRepository().list()).map((scenario) => ({
    id: scenario.id, name: scenario.name, type: scenario.type, isLocked: scenario.isLocked,
    deviceCount: scenario._count.devices, linkCount: scenario._count.physicalLinks,
  }));
  return <AppShell><DesignWizard scenarios={scenarios} /></AppShell>;
}
