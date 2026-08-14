# Guided system design workflow

## Goal

Enable a non-specialist stakeholder to create and evaluate a network alternative without editing the locked baseline or navigating every technical module separately.

## Recommended user process

1. **Start from a trusted source** — choose Baseline or Proposed and create an isolated alternative.
2. **Confirm scope and data readiness** — review device/link/model counts and disclose missing topology before simulation.
3. **Customize equipment** — select a device, restrict alternatives to the same category, preview port mapping/findings/cost delta, then explicitly commit.
4. **Define a failure session** — select one or more devices/links, run graph reachability and capacity recalculation.
5. **Review the decision** — show investment delta, replaced models, risk, impacted endpoints and deep links to detailed comparison/topology.

## UX decisions

- Progressive disclosure: one decision per step, with technical detail shown only when relevant.
- Safe-by-default: the wizard always clones before customization.
- Preview before mutation: model replacement exposes compatibility findings and price impact before commit.
- Visible data quality: missing physical links are disclosed rather than presenting a misleading capacity result.
- Persistent domain output: progress itself is transient, while scenario changes, costs and findings remain stored in PostgreSQL.
- Expert escape hatches: detailed Scenario Compare and Topology remain one click away from the final result.

## Future refinements

- Add templates for ISP loss, core failure, access-switch failure and dual-link degradation.
- Persist named simulation sessions and approval comments.
- Add topology completeness scoring before allowing executive sign-off.
- Integrate SP-4 3D floor isolation into the scope-review step.
