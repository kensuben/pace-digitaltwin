# M1 catalog evidence register

**Reviewed:** 2026-08-11  
**Scope:** Only fields populated by the M1 seed. Unknown or unreviewed values remain `null`.

| Seed SKU | Evidence | Verified fields used by M1 |
|---|---|---|
| FG-200G | https://www.fortinet.com/resources/data-sheets/fortigate-200g-series and https://docs.fortinet.com/document/fortigate/7.6.6/hardware-acceleration/793766/fortigate-200g-and-201g-fast-path-architecture | Fixed RJ45/SFP/SFP+ interface groups; performance values intentionally omitted |
| XGS-3100 | https://www.sophos.com/en-us/products/next-gen-firewall/xgs-1u-distributed-edge-firewalls | 8 GE copper, 2 SFP, 2 SFP+; firewall, IPS, NGFW and TLS inspection throughput |
| C9300X-24Y | https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9300-series-switches/nb-06-cat9300-ser-data-sheet-cte-en.html | 24 × 1/10/25G SFP28; modular uplinks excluded from generated fixed ports |
| XSM4328FV / M4350-24F4V | https://www.downloads.netgear.com/files/GDC/M4350/M4350_HIG_EN.pdf | 24 × 1/10G SFP+, 4 × 1/10/25G SFP28, 680 Gbps switching fabric |
| CRS518-16XS-2XQ-RM | https://mikrotik.com/product/crs518_16xs_2xq and https://cdn.mikrotik.com/web-assets/product_files/CRS518-16XS-2XQ-RM_220739.pdf | 16 × 25G SFP28, 2 × 100G QSFP28, 1 × 100M management, 1.2 Tbps switching capacity |

## Governance rules

- `VERIFIED_VENDOR` applies only to fields represented by the linked official source, not every nullable column on the record.
- Fixed port profiles exclude optional modules unless a separate installed module becomes explicit inventory.
- Seeded DeviceInstance identifiers, management state and physical placement are planning data, not verified operational inventory.
- Updating a verified vendor model requires a reviewed evidence change; the M1 API keeps those rows read-only.
