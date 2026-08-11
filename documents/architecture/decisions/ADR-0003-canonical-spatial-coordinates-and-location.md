# ADR-0003 — Canonical spatial coordinates and location ownership

- Status: Accepted
- Date: 2026-08-11
- Owners: Project team
- Related: SOP-SC181-001, SOP-SC181-002

## Context

SOP-001 stores administrative device location on `DeviceInstance`. SOP-002 introduces PDF, floor, building, screen and Three.js coordinate spaces plus `DevicePlacement`. Persisting view pixels or allowing these records to disagree would make drawing revisions and scenario comparison unsafe.

## Decision

### Location ownership

- `DeviceInstance.buildingId/floorId/zoneId/rackId/rackUnitStart` is the authoritative administrative and rack assignment for its scenario.
- `DevicePlacement` stores only the spatial projection of that assignment.
- Placement floor and scenario must match the associated DeviceInstance.
- Moving a marker inside the same floor changes only DevicePlacement.
- Moving a device to another floor is a `relocateDevice` transaction that updates DeviceInstance location, placement and audit together.
- `RackPlacement` describes where a Rack stands; it does not replace DeviceInstance rack assignment and must be scenario-aware when used in a proposed design.

### Canonical coordinate space

- Persisted spatial unit is meters using PostgreSQL double precision/Prisma `Float`.
- Floor-local origin is the top-left point selected during map alignment.
- Canonical axes are `X_RIGHT`, `Y_DOWN`, `Z_UP`; they describe the plan, not geographic longitude/latitude.
- `xMeters/yMeters/zMeters` are floor-local. Building elevation is `Floor.elevationMeters + zMeters` only when floor elevation is confirmed.
- `Floor.elevationMeters` and `floorToFloorHeightMeters` are nullable. Unknown values are never inferred or seeded.

### Transform ownership

All transforms are pure functions in `SpatialTransformService`:

```text
PDF points <-> floor-local meters <-> building world <-> Three.js <-> screen
```

PDF page viewport, crop, rotation, scale and origin are represented by an explicit affine transform. A new drawing revision receives a new map transform; canonical placements do not move.

Three.js mapping is centralized:

```text
three.x = floor.xMeters
three.y = floor.elevationMeters + placement.zMeters
three.z = floor.yMeters
```

Presentation transforms such as pan, zoom, camera projection and exploded-floor offsets are never persisted as canonical coordinates.

### Geometry storage

- Local floor geometry is stored as versioned JSON tied to `coordinateSystemId`.
- It is not named or treated as geographic GeoJSON/WGS84.
- Every geometry DTO is validated by Zod for finite coordinates, minimum vertices and bounds.
- PostGIS is not required for MVP; adopting it later requires an ADR and migration.

## Alternatives considered

- Screen pixels were rejected because zoom, DPI and viewport changes would alter persisted positions.
- PDF points were rejected because placements must survive drawing replacement.
- Removing location fields from DeviceInstance was rejected because Inventory and topology require location without loading a floor map.

## Consequences

- M1 adds nullable Floor elevation fields and authoritative device location constraints.
- SP-0 adds coordinate systems and placement records against these stable contracts.
- SP-2 tests must cover PDF Y-axis inversion, crop, rotation, zoom and pan.

## Rollback / migration impact

Changing unit or axis convention later requires versioned coordinate migration and must not mutate historical scenarios silently.

