"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Vlan = {
  id: string;
  vlanId: number;
  name: string;
  purpose: string | null;
};
type Subnet = {
  id: string;
  name: string;
  cidr: string;
  gateway: string | null;
  vlanId: string | null;
  vrf: string | null;
};
type Port = { id: string; name: string; supportedSpeedsMbps: number[] };
type Device = { id: string; hostname: string; ports: Port[] };
type Lag = {
  id: string;
  deviceInstanceId: string;
  name: string;
  protocol: string;
  mode: string;
  minLinks: number;
  members: Array<{ portId: string }>;
};
type Membership = {
  id: string;
  portId: string | null;
  lagGroupId: string | null;
  mode: string;
  nativeVlanId: string | null;
  port: { name: string; device: { hostname: string } } | null;
  lagGroup: { name: string; device: { hostname: string } } | null;
  allowedVlans: Array<{ vlanId: string; vlan: Vlan }>;
};

export interface NetworkConfigData {
  scenario: { id: string; name: string; isLocked: boolean };
  lags: Lag[];
  vlans: Vlan[];
  subnets: Subnet[];
  memberships: Membership[];
  devices: Device[];
}

const inputClass = "rounded-md border bg-background p-2";
const buttonClass =
  "rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50";

export function NetworkConfigManager({ data }: { data: NetworkConfigData }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const locked = data.scenario.isLocked;

  async function mutate(
    url: string,
    method: "POST" | "PATCH" | "DELETE",
    body?: object,
  ) {
    setMessage("");
    const response = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = (await response.json()) as { error?: { message?: string } };
    if (!response.ok) {
      setMessage(payload.error?.message ?? "Operation failed.");
      return false;
    }
    setMessage("Saved.");
    router.refresh();
    return true;
  }

  async function createVlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (
      await mutate("/api/vlans", "POST", {
        scenarioId: data.scenario.id,
        vlanId: Number(form.get("vlanId")),
        name: form.get("name"),
        purpose: form.get("purpose") || null,
      })
    )
      formElement.reset();
  }
  async function createSubnet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (
      await mutate("/api/subnets", "POST", {
        scenarioId: data.scenario.id,
        name: form.get("name"),
        cidr: form.get("cidr"),
        gateway: form.get("gateway") || null,
        vlanId: form.get("vlanId") || null,
        vrf: form.get("vrf") || null,
        dnsServers: [],
      })
    )
      formElement.reset();
  }
  async function createLag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const deviceInstanceId = String(form.get("deviceInstanceId"));
    if (
      await mutate("/api/lags", "POST", {
        scenarioId: data.scenario.id,
        deviceInstanceId,
        name: form.get("name"),
        protocol: form.get("protocol"),
        mode: form.get("mode"),
        minLinks: Number(form.get("minLinks")),
        logicalSpeedPolicy: "SUM_MEMBERS",
        memberPortIds: form.getAll("memberPortIds"),
      })
    )
      formElement.reset();
  }
  async function createMembership(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const target = String(form.get("target"));
    const [kind, id] = target.split(":");
    const mode = String(form.get("mode"));
    const nativeVlanId = String(form.get("nativeVlanId") || "") || null;
    let allowedVlanIds = form.getAll("allowedVlanIds").map(String);
    if (mode === "ACCESS" && nativeVlanId) allowedVlanIds = [nativeVlanId];
    if (
      await mutate("/api/vlan-memberships", "POST", {
        scenarioId: data.scenario.id,
        portId: kind === "port" ? id : null,
        lagGroupId: kind === "lag" ? id : null,
        mode,
        nativeVlanId,
        allowedVlanIds,
      })
    )
      formElement.reset();
  }
  async function rename(
    kind: "lags" | "vlans" | "subnets",
    item: Lag | Vlan | Subnet,
  ) {
    const name = window.prompt("New name", item.name);
    if (!name || name === item.name) return;
    if (kind === "vlans")
      await mutate(
        `/api/vlans/${item.id}?scenarioId=${data.scenario.id}`,
        "PATCH",
        { ...item, name },
      );
    if (kind === "subnets")
      await mutate(
        `/api/subnets/${item.id}?scenarioId=${data.scenario.id}`,
        "PATCH",
        { ...item, name, dnsServers: [] },
      );
    if (kind === "lags") {
      const lag = item as Lag;
      await mutate(
        `/api/lags/${item.id}?scenarioId=${data.scenario.id}`,
        "PATCH",
        {
          ...lag,
          name,
          logicalSpeedPolicy: "SUM_MEMBERS",
          memberPortIds: lag.members.map((member) => member.portId),
        },
      );
    }
  }
  async function remove(path: string, id: string) {
    if (window.confirm("Delete this record?"))
      await mutate(
        `/api/${path}/${id}?scenarioId=${data.scenario.id}`,
        "DELETE",
      );
  }

  async function editMembership(membership: Membership) {
    const mode = window.prompt(
      "Mode: ACCESS, TRUNK or HYBRID",
      membership.mode,
    );
    if (!mode || !["ACCESS", "TRUNK", "HYBRID"].includes(mode)) return;
    if (mode === "ACCESS" && !membership.nativeVlanId) {
      setMessage(
        "Set a native VLAN before changing this membership to ACCESS.",
      );
      return;
    }
    await mutate(
      `/api/vlan-memberships/${membership.id}?scenarioId=${data.scenario.id}`,
      "PATCH",
      {
        portId: membership.portId,
        lagGroupId: membership.lagGroupId,
        mode,
        nativeVlanId: membership.nativeVlanId,
        allowedVlanIds:
          mode === "ACCESS"
            ? [membership.nativeVlanId]
            : membership.allowedVlans.map((allowed) => allowed.vlanId),
      },
    );
  }

  return (
    <div className="space-y-8">
      {message && (
        <p className="rounded-md border p-3" role="status">
          {message}
        </p>
      )}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-xl font-bold">LAG CRUD</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-6" onSubmit={createLag}>
          <select className={inputClass} name="deviceInstanceId" required>
            {data.devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.hostname}
              </option>
            ))}
          </select>
          <input
            className={inputClass}
            name="name"
            placeholder="Port-Channel1"
            required
          />
          <select className={inputClass} name="protocol">
            <option>LACP</option>
            <option>STATIC</option>
          </select>
          <select className={inputClass} name="mode">
            <option>ACTIVE</option>
            <option>PASSIVE</option>
            <option>ON</option>
          </select>
          <input
            className={inputClass}
            defaultValue="1"
            min="1"
            name="minLinks"
            type="number"
          />
          <select className={inputClass} multiple name="memberPortIds" required>
            {data.devices.flatMap((device) =>
              device.ports.map((port) => (
                <option key={port.id} value={port.id}>
                  {device.hostname}/{port.name}
                </option>
              )),
            )}
          </select>
          <button className={buttonClass} disabled={locked}>
            Create LAG
          </button>
        </form>
        <Rows
          items={data.lags}
          label={(lag) =>
            `${data.devices.find((device) => device.id === lag.deviceInstanceId)?.hostname ?? "?"} / ${lag.name} · ${lag.protocol} · ${lag.members.length} ports`
          }
          onEdit={(lag) => rename("lags", lag)}
          onDelete={(lag) => remove("lags", lag.id)}
          locked={locked}
        />
      </section>
      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-xl font-bold">VLAN CRUD</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-4" onSubmit={createVlan}>
          <input
            className={inputClass}
            max="4094"
            min="1"
            name="vlanId"
            placeholder="VLAN ID"
            required
            type="number"
          />
          <input
            className={inputClass}
            name="name"
            placeholder="Name"
            required
          />
          <input className={inputClass} name="purpose" placeholder="Purpose" />
          <button className={buttonClass} disabled={locked}>
            Create VLAN
          </button>
        </form>
        <Rows
          items={data.vlans}
          label={(vlan) =>
            `VLAN ${vlan.vlanId} · ${vlan.name}${vlan.purpose ? ` · ${vlan.purpose}` : ""}`
          }
          onEdit={(vlan) => rename("vlans", vlan)}
          onDelete={(vlan) => remove("vlans", vlan.id)}
          locked={locked}
        />
      </section>
      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-xl font-bold">Subnet / IP CRUD</h2>
        <form
          className="mt-4 grid gap-3 md:grid-cols-6"
          onSubmit={createSubnet}
        >
          <input
            className={inputClass}
            name="name"
            placeholder="Name"
            required
          />
          <input
            className={inputClass}
            name="cidr"
            placeholder="10.0.10.0/24"
            required
          />
          <input className={inputClass} name="gateway" placeholder="Gateway" />
          <select className={inputClass} name="vlanId">
            <option value="">No VLAN</option>
            {data.vlans.map((vlan) => (
              <option key={vlan.id} value={vlan.id}>
                VLAN {vlan.vlanId}
              </option>
            ))}
          </select>
          <input className={inputClass} name="vrf" placeholder="VRF" />
          <button className={buttonClass} disabled={locked}>
            Create subnet
          </button>
        </form>
        <Rows
          items={data.subnets}
          label={(subnet) =>
            `${subnet.name} · ${subnet.cidr}${subnet.gateway ? ` · GW ${subnet.gateway}` : ""}`
          }
          onEdit={(subnet) => rename("subnets", subnet)}
          onDelete={(subnet) => remove("subnets", subnet.id)}
          locked={locked}
        />
      </section>
      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-xl font-bold">Interface VLAN membership CRUD</h2>
        <form
          className="mt-4 grid gap-3 md:grid-cols-5"
          onSubmit={createMembership}
        >
          <select className={inputClass} name="target" required>
            <option value="">Choose interface</option>
            {data.devices.flatMap((device) =>
              device.ports.map((port) => (
                <option key={port.id} value={`port:${port.id}`}>
                  {device.hostname}/{port.name}
                </option>
              )),
            )}
            {data.lags.map((lag) => (
              <option key={lag.id} value={`lag:${lag.id}`}>
                LAG/{lag.name}
              </option>
            ))}
          </select>
          <select className={inputClass} name="mode">
            <option>ACCESS</option>
            <option>TRUNK</option>
            <option>HYBRID</option>
          </select>
          <select className={inputClass} name="nativeVlanId">
            <option value="">No native VLAN</option>
            {data.vlans.map((vlan) => (
              <option key={vlan.id} value={vlan.id}>
                VLAN {vlan.vlanId}
              </option>
            ))}
          </select>
          <select className={inputClass} multiple name="allowedVlanIds">
            {data.vlans.map((vlan) => (
              <option key={vlan.id} value={vlan.id}>
                VLAN {vlan.vlanId}
              </option>
            ))}
          </select>
          <button className={buttonClass} disabled={locked}>
            Create membership
          </button>
        </form>
        <Rows
          items={data.memberships}
          label={(membership) =>
            `${membership.port ? `${membership.port.device.hostname}/${membership.port.name}` : `${membership.lagGroup?.device.hostname}/${membership.lagGroup?.name}`} · ${membership.mode} · ${membership.allowedVlans.map((allowed) => allowed.vlan.vlanId).join(", ")}`
          }
          onEdit={editMembership}
          onDelete={(membership) => remove("vlan-memberships", membership.id)}
          locked={locked}
        />
      </section>
    </div>
  );
}

function Rows<T extends { id: string }>({
  items,
  label,
  onEdit,
  onDelete,
  locked,
}: {
  items: T[];
  label: (item: T) => string;
  onEdit?: (item: T) => void;
  onDelete: (item: T) => void;
  locked: boolean;
}) {
  return (
    <div className="mt-4 divide-y rounded-md border">
      {items.length ? (
        items.map((item) => (
          <div
            className="flex items-center justify-between gap-4 p-3"
            key={item.id}
          >
            <span>{label(item)}</span>
            <span className="flex gap-2">
              {onEdit && (
                <button
                  className="rounded border px-3 py-1"
                  disabled={locked}
                  onClick={() => onEdit(item)}
                  type="button"
                >
                  Edit
                </button>
              )}
              <button
                className="rounded border border-destructive px-3 py-1 text-destructive"
                disabled={locked}
                onClick={() => onDelete(item)}
                type="button"
              >
                Delete
              </button>
            </span>
          </div>
        ))
      ) : (
        <p className="p-3 text-muted-foreground">No records.</p>
      )}
    </div>
  );
}
