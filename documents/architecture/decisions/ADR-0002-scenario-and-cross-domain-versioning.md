# ADR-0002 — Scenario and cross-domain versioning

- Status: Accepted
- Date: 2026-08-11
- Owners: Project team
- Related: SOP-SC181-001, SOP-SC181-002

## Context

Network design data is versioned by `Scenario`, while campus hierarchy, drawings and spatial maps can be shared between scenarios. Without an explicit ownership model, scenario cloning can create cross-scenario links or duplicate immutable building evidence.

## Decision

### Shared reference data

The following records exist independently from scenarios:

- Campus, Building, Floor, Zone and Rack;
- Vendor, DeviceModel and PortProfile;
- DrawingDocument, DrawingPage and DrawingRevision;
- SpatialCoordinateSystem;
- shared FloorMap and shared BuildingModel3D records where `scenarioId` is null.

Source drawings and their revisions are evidence. They are never cloned with a scenario and are never overwritten by a new revision.

### Scenario-owned data

The following records belong to exactly one scenario:

- DeviceInstance and Port;
- PhysicalLink, LagGroup, VLAN, subnet membership and redundancy configuration;
- DevicePlacement, CableRoute and scenario validation findings;
- scenario-specific FloorMap or BuildingModel3D overrides where `scenarioId` is non-null.

Scenario clone performs a transactional deep copy of scenario-owned records and preserves references to shared records. The clone order is parent records first, followed by ports, links, placements, routes and findings. Old-to-new ID maps are kept only for the transaction/audit operation.

### Boundary enforcement

- Every scenario-scoped service requires an explicit `scenarioId` context.
- Cross-scenario relations are rejected by service validation and composite database constraints.
- Scenario-owned parents expose a composite candidate key such as `@@unique([id, scenarioId])` so dependent records can reference both values.
- `DevicePlacement` retains `scenarioId` for boundary filtering and must reference `DeviceInstance(id, scenarioId)` as a composite foreign key.
- `CableRoute` and its optional `PhysicalLink` must have the same scenario.
- A locked Baseline cannot be mutated or deleted by Editor.

### Floor maps and active revisions

- `scenarioId = null` means a shared building map.
- A scenario-specific map may override a shared map without copying the source DrawingDocument.
- At most one active map exists for a floor, scenario scope and map purpose/discipline.
- Because nullable uniqueness needs explicit PostgreSQL handling, partial unique indexes will be added in reviewed SQL migrations where Prisma constraints alone are insufficient.

### Delete behavior

- Deleting a drawing never deletes canonical device placements.
- FloorMap deletion is restricted while referenced; an Admin-only explicit operation may detach the map while preserving floor coordinates.
- Scenario deletion cascades only through scenario-owned data and audit retention policy remains explicit.

## Alternatives considered

- Cloning every drawing/map with each scenario was rejected because it duplicates large evidence graphs and complicates revision history.
- Keeping scenario ownership only in application code was rejected because a missed filter could leak or corrupt another scenario.
- Sharing DeviceInstance records across scenarios was rejected because model swaps and placement alternatives must remain isolated.

## Consequences

- M1 must establish composite scenario keys before dependent topology/spatial migrations.
- SP-0 can add placement and map records without changing the ownership of M1 entities.
- Scenario cloning is more expensive than shallow copy but deterministic and auditable.

## Rollback / migration impact

This ADR precedes the first domain migration. Reversing it later would require a major schema/data migration and a new ADR.

