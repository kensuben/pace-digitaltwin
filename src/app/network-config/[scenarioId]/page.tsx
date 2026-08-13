import { AppShell } from "@/components/app-shell";
import {
  NetworkConfigManager,
  type NetworkConfigData,
} from "@/components/network-config/network-config-manager";
import { getNetworkConfig } from "@/server/services/networkConfigService";
export const dynamic = "force-dynamic";
export default async function ScenarioNetworkConfigPage({
  params,
}: {
  params: Promise<{ scenarioId: string }>;
}) {
  const { scenarioId } = await params;
  const data = (await getNetworkConfig(scenarioId)) as NetworkConfigData;
  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            M3 · CRUD
          </p>
          <h1 className="mt-2 text-4xl font-bold">{data.scenario.name}</h1>
          <p className="mt-3 text-muted-foreground">
            LAG, VLAN, subnet/IP và interface membership cùng dùng scenario
            scope.
            {data.scenario.isLocked ? " Scenario đang khóa: chỉ đọc." : ""}
          </p>
        </div>
        <NetworkConfigManager data={data} />
      </div>
    </AppShell>
  );
}
