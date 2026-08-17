import { z } from "zod";

import { AppError } from "@/server/errors";
import { PrismaRackDesignRepository, type RackDesignRepository } from "@/server/repositories/rackDesignRepository";

const placementSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("place"), rackId: z.string().min(1), rackUnitStart: z.number().int().positive() }),
  z.object({ action: z.literal("remove") }),
]);

export async function getRackRoomDesign(
  scenarioId: string,
  repository: RackDesignRepository = new PrismaRackDesignRepository(),
) {
  const scenario = await repository.getScenario(scenarioId);
  if (!scenario) throw new AppError("SCENARIO_NOT_FOUND", "Scenario was not found.", 404);
  const room = await repository.getB2Room(scenarioId);
  return { scenario, ...room };
}

export async function placeDeviceInRack(
  scenarioId: string,
  deviceId: string,
  input: unknown,
  repository: RackDesignRepository = new PrismaRackDesignRepository(),
) {
  const parsed = placementSchema.safeParse(input);
  if (!parsed.success)
    throw new AppError("INVALID_RACK_PLACEMENT", parsed.error.issues[0]?.message ?? "Invalid rack placement.", 400);

  const targetRackId = parsed.data.action === "place" ? parsed.data.rackId : null;
  const context = await repository.getPlacementContext(scenarioId, deviceId, targetRackId);
  if (!context.scenario) throw new AppError("SCENARIO_NOT_FOUND", "Scenario was not found.", 404);
  if (context.scenario.isLocked) throw new AppError("SCENARIO_LOCKED", "Locked scenarios cannot be changed.", 409);
  if (!context.device) throw new AppError("DEVICE_NOT_FOUND", "Device was not found in this scenario.", 404);

  if (parsed.data.action === "remove") {
    await repository.savePlacement(scenarioId, deviceId, null, null, null);
    return { deviceId, rackId: null, rackUnitStart: null };
  }

  if (!context.rack) throw new AppError("RACK_NOT_FOUND", "Rack was not found.", 404);
  if (context.device.floorId !== context.rack.zone.floorId)
    throw new AppError("RACK_FLOOR_MISMATCH", "Device and rack must be on the same floor.", 400);

  const height = context.device.model.rackUnits ?? 1;
  const rackUnitStart = parsed.data.rackUnitStart;
  const end = rackUnitStart + height - 1;
  if (end > context.rack.rackUnits)
    throw new AppError("RACK_CAPACITY_EXCEEDED", `Device requires ${height}U and exceeds the ${context.rack.rackUnits}U rack.`, 409);

  const collision = context.occupants.find((occupant) => {
    if (!occupant.rackUnitStart) return false;
    const occupantEnd = occupant.rackUnitStart + (occupant.model.rackUnits ?? 1) - 1;
    return rackUnitStart <= occupantEnd && end >= occupant.rackUnitStart;
  });
  if (collision)
    throw new AppError("RACK_UNIT_OCCUPIED", `U${parsed.data.rackUnitStart}–U${end} overlaps ${collision.hostname}.`, 409);

  await repository.savePlacement(
    scenarioId,
    deviceId,
    context.rack.id,
    context.rack.zoneId,
    rackUnitStart,
  );
  return { deviceId, rackId: context.rack.id, rackUnitStart };
}
