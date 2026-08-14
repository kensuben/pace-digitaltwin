import { AppError } from "@/server/errors";
import {
  PrismaProjectCostRepository,
  type ProjectCostRepository,
} from "@/server/repositories/projectCostRepository";

type CostData = {
  id: string;
  name: string;
  type: string;
  devices: Array<{
    model: {
      id: string;
      sku: string;
      modelName: string;
      category: string;
      unitPriceVnd: number | null;
      priceVatRateBps: number;
      pricingSource: string | null;
      vendor: { name: string };
    };
  }>;
  costItems: Array<{
    id: string;
    code: string;
    category: string;
    description: string;
    quantity: number;
    unitCostVnd: number;
    vatRateBps: number;
    source: string | null;
  }>;
};

function money(subtotalVnd: number, vatRateBps: number) {
  const vatVnd = Math.round((subtotalVnd * vatRateBps) / 10_000);
  return { subtotalVnd, vatVnd, totalVnd: subtotalVnd + vatVnd };
}

export async function listCostScenarios(
  repository: ProjectCostRepository = new PrismaProjectCostRepository(),
) {
  return repository.listScenarios();
}

export async function getProjectCostSummary(
  scenarioId: string,
  repository: ProjectCostRepository = new PrismaProjectCostRepository(),
) {
  if (!scenarioId)
    throw new AppError("SCENARIO_REQUIRED", "scenarioId is required.", 400);
  const data = (await repository.getScenarioCostData(
    scenarioId,
  )) as CostData | null;
  if (!data)
    throw new AppError("SCENARIO_NOT_FOUND", "Scenario was not found.", 404);

  const modelGroups = new Map<
    string,
    CostData["devices"][number]["model"] & { quantity: number }
  >();
  for (const { model } of data.devices) {
    const current = modelGroups.get(model.id);
    if (current) current.quantity += 1;
    else modelGroups.set(model.id, { ...model, quantity: 1 });
  }

  const deviceLines = [...modelGroups.values()].map((model) => ({
    kind: "DEVICE" as const,
    code: model.sku,
    description: `${model.vendor.name} ${model.modelName}`,
    category: model.category,
    quantity: model.quantity,
    unitCostVnd: model.unitPriceVnd,
    source: model.pricingSource,
    ...(model.unitPriceVnd === null
      ? { subtotalVnd: 0, vatVnd: 0, totalVnd: 0 }
      : money(model.unitPriceVnd * model.quantity, model.priceVatRateBps)),
  }));
  const fixedLines = data.costItems.map((item) => ({
    kind: "FIXED" as const,
    code: item.code,
    description: item.description,
    category: item.category,
    quantity: item.quantity,
    unitCostVnd: item.unitCostVnd,
    source: item.source,
    ...money(item.unitCostVnd * item.quantity, item.vatRateBps),
  }));
  const lines = [...deviceLines, ...fixedLines];
  const subtotalVnd = lines.reduce((sum, line) => sum + line.subtotalVnd, 0);
  const vatVnd = lines.reduce((sum, line) => sum + line.vatVnd, 0);
  const categoryMap = new Map<string, number>();
  for (const line of lines)
    categoryMap.set(
      line.kind === "DEVICE" ? "DEVICES" : line.category,
      (categoryMap.get(line.kind === "DEVICE" ? "DEVICES" : line.category) ??
        0) + line.totalVnd,
    );

  return {
    scenario: { id: data.id, name: data.name, type: data.type },
    currency: "VND",
    deviceCount: data.devices.length,
    pricedDeviceCount: data.devices.filter(
      ({ model }) => model.unitPriceVnd !== null,
    ).length,
    unpricedDeviceCount: data.devices.filter(
      ({ model }) => model.unitPriceVnd === null,
    ).length,
    subtotalVnd,
    vatVnd,
    totalVnd: subtotalVnd + vatVnd,
    categories: [...categoryMap.entries()]
      .map(([category, totalVnd]) => ({ category, totalVnd }))
      .sort((a, b) => b.totalVnd - a.totalVnd),
    lines: lines.sort((a, b) => b.totalVnd - a.totalVnd),
  };
}
