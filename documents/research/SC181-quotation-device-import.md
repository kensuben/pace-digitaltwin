# SC181 quotation device import

Reviewed sources:

- `BG_THIET BI_TONG HOP_GiaiPhap_Netgear_X3100.pdf`, dated 2026-08-13.
- `BG_MICROTIK&XGS3100.pdf`, dated 2026-07-24.
- `BG_CISCO 25GB &XGS3100.pdf`, dated 2026-07-15.

## Import decision

The quotations are mutually exclusive core/access alternatives. All managed hardware models are added to Catalog so model swap and comparison can be demonstrated. Only the latest Netgear proposal populates `scenario-proposed`:

| Model | Role | Demo quantity |
|---|---|---:|
| Sophos XGS 3100 | Firewall | 1 |
| NETGEAR M4350-24F4V / XSM4328FV | Core | 2 |
| NETGEAR GS728TXv3 | Access | 10 |
| NETGEAR GS752TXv3 | Access | 1 |
| MAIPU IS230-10TP-AC | PoE access | 12 |
| UniFi U7 Pro | Wireless AP | 24 |

The MikroTik and Cisco managed switch models are Catalog alternatives only. Licenses, optics, patch cords, ODFs, patch panels, power supplies, stack cables, racks and installation services are not `DeviceInstance` records.

## Verification policy

- Quantities and quoted SKUs come from the supplied PDFs.
- Port profiles are checked against official vendor product pages or data sheets.
- Quoted device prices are stored as model pricing evidence; license, passive material and service lines are scenario-owned `ProjectCostItem` records. Totals are always derived from current inventory and cost items.
- Seeded instances remain `PLANNED`; serial numbers, management IPs, final floor assignment and installed status require user confirmation.

## Cost reconciliation

The Proposed scenario reproduces the 2026-08-13 quotation:

| Measure | Amount (VND) |
|---|---:|
| Subtotal | 1,090,923,400 |
| VAT | 81,994,400 |
| Grand total | 1,172,917,800 |

Changing device quantity or model changes the derived device lines automatically. Totals are not persisted.
