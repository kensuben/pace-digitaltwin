# SC181 integrated implementation roadmap

This roadmap resolves the dependency order between SOP-SC181-001 network phases and SOP-SC181-002 spatial phases.

| Order | Milestone | Status | Exit gate |
|---:|---|---|---|
| 0 | M0 Foundation | Done | Web, DB scaffold, tests, app image and CI pass |
| 1 | M0.1 Architecture alignment | Done | ADR-0002/3/4, integrated ERD, shadcn foundation and migrator gate pass |
| 2 | M1 Inventory & Catalog | Done | Two reviewed migrations, seed evidence, Inventory/Catalog/Device Detail pass |
| 3 | SP-0 Spatial schema & storage | Done | Spatial migration and filesystem ObjectStorage adapter pass |
| 4 | M2 Network topology | Ready | Port-first links and persisted editor pass |
| 5 | SP-1 PDF ingestion | Pending | Isolated worker, previews, jobs and floor mapping pass |
| 6 | M3 LAG/VLAN/IP | Pending | Network logical configuration and validation pass |
| 7 | SP-2 2D floor editor | Pending | Calibration and placement persistence in meters pass |
| 8 | M4 Model swap & validation | Pending | Preview/commit and network/spatial findings pass |
| 9 | SP-3 Zones/cabling/risers | Pending | Manual geometry and multi-floor cable routes pass |
| 10 | M5 Scenario/simulation | Pending | Clone/compare/failure simulation pass |
| 11 | SP-4/SP-5 GLB and sync | Pending | 3D floor isolation and 2D/3D selection sync pass |
| 12 | M6/SP-6 polish | Pending | PACE data, advanced extraction and security/UAT pass |
| 13 | M7 Production readiness | Pending | Restore/deploy/rollback drill and go-live approval pass |

## Dependency rules

- M1 cannot create its migration until ADR-0002 and ADR-0003 are accepted.
- SP-0 depends on M1 identifiers and location hierarchy.
- SP-1 depends on ADR-0004 and a resolved PDF processing license.
- SP-2 depends on SP-0 storage/coordinates; it does not depend on vector extraction.
- SP-4 accepts GLB first and never waits for native 3D PDF conversion.
- No phase adds optional libraries until its acceptance tests require them.
