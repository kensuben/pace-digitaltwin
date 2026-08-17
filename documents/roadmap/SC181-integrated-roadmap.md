# SC181 integrated implementation roadmap

This roadmap resolves the dependency order between SOP-SC181-001 network phases and SOP-SC181-002 spatial phases.

| Order | Milestone | Status | Exit gate |
|---:|---|---|---|
| 0 | M0 Foundation | Done | Web, DB scaffold, tests, app image and CI pass |
| 1 | M0.1 Architecture alignment | Done | ADR-0002/3/4, integrated ERD, shadcn foundation and migrator gate pass |
| 2 | M1 Inventory & Catalog | Done | Two reviewed migrations, seed evidence, Inventory/Catalog/Device Detail pass |
| 3 | SP-0 Spatial schema & storage | Done | Spatial migration and filesystem ObjectStorage adapter pass |
| 4 | M2 Network topology | Done | Port-first links and persisted editor pass |
| 5 | SP-1 PDF ingestion | Done | Isolated worker, previews, jobs and floor mapping pass |
| 6 | M3 LAG/VLAN/IP | Done | Network logical configuration and validation pass |
| 7 | SP-2 2D floor editor | Done | Calibration and placement persistence in meters pass |
| 8 | M4 Model swap & validation | Done | Preview/commit and network/spatial findings pass |
| 9 | SP-3 Zones/cabling/risers | Done | Manual geometry and multi-floor cable routes pass |
| 10 | M5 Scenario/simulation | Done | Clone/compare/failure simulation pass |
| 11 | SP-4/SP-5 GLB and sync | Pending | 3D floor isolation and 2D/3D selection sync pass |
| 12 | M6/SP-6 polish | Pending | PACE data, advanced extraction and security/UAT pass |
| 13 | M7 Production readiness | Pending | Restore/deploy/rollback drill and go-live approval pass |

## Guided design workflow extension

- Done: five-step System Design Wizard covering safe clone, scope review, compatible model replacement, multi-target network failure session and decision summary.
- Done: automatic cost/model comparison, risk/impact/capacity result and deep links into detailed Scenario Compare and Topology.
- Done: executive overview and navigation refresh with the guided workflow as the primary call to action.
- Research note: `documents/research/guided-system-design-workflow.md` documents the user process, safety principles and follow-up refinements.

## Floor-first topology redesign

- Done: B2 Server Room remains fixed while users design and review one building floor at a time.
- Done: manual floor-to-B2 device mapping with automatic compatible-port and maximum-common-speed selection.
- Done: automatic uplink discovery for unconnected access/distribution switches toward available B2 Core/Firewall ports.
- Done: Network Structure calculation produces readiness, VLAN segmentation and per-floor IP/subnet recommendations from the current topology.
- Done: add/remove devices directly within the active floor; model port profiles are generated on add and dependent links/routes are removed transactionally with the device.
- Done: local floor mapping supports endpoint-to-switch links; AP devices require available PoE ports and automatic mapping prioritizes local PoE switches before the floor uplink to B2.
- Done: cross-floor shared-switch mapping allows endpoints/User Nodes on one floor to use an Access/Distribution switch physically located on another non-B2 floor; shared links and switches remain visible in the served floor topology and use an amber visual state distinct from B2 uplinks.
- Done: same-floor switch-to-switch mapping (for example `POE-02 → ACC-01`) and connection-state lights distinguish local links (blue), B2 uplinks (green), and devices carrying both roles (dual color).
- Done: organization-style topology visual calculates hierarchy from persisted links and draws labeled directional vectors from B2/Core through floor switches to PoE and endpoints.
- Done: unified 40/60 topology workspace with active-floor inventory above fixed B2 inventory on the left and a draggable organization diagram on the right; vectors and speed labels track device movement.
- Done: local-mapping scope switch supports both the active floor and B2 Server Room; B2 allows Firewall/Server/PoE-to-Core connections and renders them as local blue vectors.
- Done: Core-to-Core links in B2 are recognized as HA peer links and rendered horizontally with a violet dashed vector, arrowheads in both directions and an `HA · speed` label.
- Done: organization card positions can be saved to scenario topology coordinates and restored on reload; the floor selector now uses the building hierarchy so empty B1 remains available for design and device creation.
- Done: approved Network Structure recommendations can be persisted idempotently as scenario VLAN/Subnet records from the topology result panel.
- Done: the Dual Uplink policy template completes each floor Access/Distribution switch toward two distinct B2 Core switches, reuses existing links and reports partial completion when compatible ports are insufficient.
- Next: begin SP-4 GLB floor isolation and 2D/3D selection sync.

## Inventory UX extensions

- Done: editable hostname and display name on device detail, including a controlled identity-only exception for locked Baseline; technical mutations remain locked, with hostname normalization and scenario-scoped duplicate detection.
- Done: `DESKTOP_LAPTOP` and `PRINTER` planning categories with one-port generic Catalog models and bulk node creation by floor (1–200 nodes per action).
- Done: HIKVISION camera quotation import includes 20-unit dome and 5-unit bullet alternatives at 1,890,000 VND/unit with 8% VAT pricing metadata; Camera/AP local mapping requires a PoE switch port.

## Dependency rules

- M1 cannot create its migration until ADR-0002 and ADR-0003 are accepted.
- SP-0 depends on M1 identifiers and location hierarchy.
- SP-1 depends on ADR-0004 and a resolved PDF processing license.
- ADR-0005 resolved the SP-1 license gate with PDF.js (Apache-2.0) and `@napi-rs/canvas` (MIT).
- SP-2 depends on SP-0 storage/coordinates; it does not depend on vector extraction.
- SP-4 accepts GLB first and never waits for native 3D PDF conversion.
- No phase adds optional libraries until its acceptance tests require them.

## SP-3 progress

- Done: validated spatial-zone, cable-route and riser write services and APIs.
- Done: canonical area/3D length calculation, scenario locking, reference integrity and cross-floor riser enforcement.
- Done: floor spatial read model exposes zones, routes and building risers.
- Done: direct polygon-zone and cable-route drawing, saved-layer rendering and measurement tools in the 2D editor.
- Done: rack placement with physical footprint and direct multi-floor route creation through building risers.
- Done: interactive B2 rack elevation designer with scenario-aware device placement, drag/drop, rack-unit capacity and overlap validation.
- Reference evidence: PACE Cô Giang A2 sheets show the B2 server room and repeated stair/elevator service core; the 118-page interior package confirms floor/room wayfinding. Coordinates remain user-calibrated rather than inferred from drawings.
- Demo data: the Proposed scenario is populated with 50 managed devices from the latest Netgear/Sophos/Maipu/UniFi quotation; Cisco and MikroTik quotation models are available in Catalog for comparison.
- Acceptance: manual geometry, calibrated measurement, rack placement and multi-floor routes pass with the imported PACE reference sheets.
- Next: complete M5 scenario/simulation acceptance and demo UAT.

## M5 progress

- Done: transactional scenario clone for devices/ports/links, LAG/VLAN/IP, validation, cost items and spatial floor-map/placement/route data with ID remapping and audit evidence.
- Done: side-by-side device, model, link, validation and estimated-cost delta.
- Done: device/link failure simulation with graph reachability, impacted-device list, risk level and remaining-capacity calculation.
- Done: executive Scenario Lab UI for clone, compare and interactive failure selection.
- Done: unit acceptance coverage for scenario cost/model deltas, disconnected graph traversal, critical root failure and cross-scenario target rejection.
- UAT evidence (2026-08-14): cloned `scenario-proposed` into `M5 Demo UAT - Quotation Alternative`; source/target both contain 50 devices and 13 cost items, with zero device/link/cost delta.
- UAT evidence (2026-08-14): failure of `CORE-01` produced `HIGH` risk and 48 impacted devices. Capacity remained 0 Mbps because the quotation demo dataset does not yet contain physical links; linked-graph capacity and reachability are covered by unit acceptance tests.
- Exit gate: clone, compare and failure simulation pass; M5 is complete.
- Next: begin SP-4 GLB floor isolation and 2D/3D selection sync.

## Demo costing extension

- Done: quotation-backed model prices and scenario cost items with per-line VAT.
- Done: live project total derived from inventory, including automatic model-swap cost impact.
- Done: executive dashboard with KPI totals, cost composition, pricing coverage and itemized detail.
